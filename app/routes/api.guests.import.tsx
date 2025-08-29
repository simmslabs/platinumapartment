import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { emailService } from "~/utils/email.server";
import bcrypt from "bcryptjs";
import * as XLSX from 'xlsx';

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);
  
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "import") {
    try {
      const file = formData.get("file") as File;
      
      if (!file) {
        return json({ error: "No file provided" }, { status: 400 });
      }

      // Read the Excel file
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // Get the first worksheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (data.length === 0) {
        return json({ error: "Excel file is empty or has no valid data" }, { status: 400 });
      }

      const results = {
        total: data.length,
        success: 0,
        errors: [] as string[],
        imported: [] as any[],
      };

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
          // Validate required fields (case-insensitive)
          const firstName = row.firstName || row.FirstName || row.first_name || row['First Name'];
          const lastName = row.lastName || row.LastName || row.last_name || row['Last Name'];
          const email = row.email || row.Email || row.EMAIL;
          const phone = row.phone || row.Phone || row.PHONE || null;
          const address = row.address || row.Address || row.ADDRESS || null;

          // Generate a random temporary password
          const generatePassword = () => {
            const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
            let password = '';
            for (let i = 0; i < 8; i++) {
              password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return password;
          };

          const temporaryPassword = generatePassword();

          if (!firstName || !lastName) {
            results.errors.push(`Row ${i + 1}: Missing required fields (firstName, lastName)`);
            continue;
          }

          // Validate email format if email is provided
          if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
              results.errors.push(`Row ${i + 1}: Invalid email format - ${email}`);
              continue;
            }

            // Check if email already exists
            const existingUser = await db.user.findUnique({ where: { email } });
            if (existingUser) {
              results.errors.push(`Row ${i + 1}: Email already exists - ${email}`);
              continue;
            }
          }

          // Hash the password
          const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

          // Create the user
          const newUser = await db.user.create({
            data: {
              email: email || null, // Make email optional
              password: hashedPassword,
              firstName: String(firstName).trim(),
              lastName: String(lastName).trim(),
              phone: phone ? String(phone).trim() : null,
              address: address ? String(address).trim() : null,
              role: "TENANT",
            },
          });

          results.imported.push({
            firstName,
            lastName,
            email: email || null,
          });

          // Send welcome email only if email is provided (async, don't wait)
          if (email) {
            emailService.sendWelcomeEmail({
              firstName,
              lastName,
              email,
              temporaryPassword: temporaryPassword,
            }).catch(error => {
              console.error(`Failed to send welcome email to ${email}:`, error);
            });
          }

          results.success++;
        } catch (error: unknown) {
          console.error(`Error processing row ${i + 1}:`, error);
          results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return json({
        success: true,
        results,
        message: `Import completed. ${results.success} guests imported successfully, ${results.errors.length} errors.`
      });

    } catch (error: unknown) {
      console.error("Excel import error:", error);
      return json({ error: `Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
    }
  }

  if (intent === "download-template") {
    try {
      // Create sample data
      const sampleData = [
        {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          phone: "+1234567890",
          address: "123 Main Street, City, State"
        },
        {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com", 
          phone: "+0987654321",
          address: "456 Oak Avenue, City, State"
        }
      ];

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sampleData);

      // Set column widths
      const colWidths = [
        { wch: 15 }, // firstName
        { wch: 15 }, // lastName  
        { wch: 25 }, // email
        { wch: 15 }, // phone
        { wch: 30 }, // address
      ];
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tenants");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Return the Excel file
      return new Response(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="guest-import-template.xlsx"',
        },
      });

    } catch (error: any) {
      console.error("Template download error:", error);
      return json({ error: `Failed to generate template: ${error.message}` }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
