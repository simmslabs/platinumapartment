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
      const data = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

      if (data.length === 0) {
        return json({ error: "Excel file is empty or has no valid data" }, { status: 400 });
      }

      const results = {
        total: data.length,
        success: 0,
        errors: [] as string[],
        imported: [] as Array<{ firstName: string; lastName: string; email: string }>,
      };

      // Process in chunks for better performance
      const chunkSize = 50; // Process 50 records at a time
      const totalChunks = Math.ceil(data.length / chunkSize);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, data.length);
        const chunk = data.slice(start, end);

        // Process each row in the current chunk
        for (let i = 0; i < chunk.length; i++) {
          const row = chunk[i];
          const actualRowIndex = start + i + 1; // +1 for 1-based indexing
          
          try {
            // Validate required fields (case-insensitive)
            const firstName = row.firstName || row.FirstName || row.first_name || row['First Name'];
            const lastName = row.lastName || row.LastName || row.last_name || row['Last Name'];
            const email = row.email || row.Email || row.EMAIL;
            const phone = row.phone || row.Phone || row.PHONE || null;
            const address = row.address || row.Address || row.ADDRESS || null;

            if (!firstName || !lastName || !email) {
              results.errors.push(`Row ${actualRowIndex}: Missing required fields (firstName, lastName, email)`);
              continue;
            }

            // Convert email to string and validate format
            const emailStr = String(email);
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailStr)) {
              results.errors.push(`Row ${actualRowIndex}: Invalid email format - ${emailStr}`);
              continue;
            }

            // Check if email already exists
            const existingUser = await db.user.findUnique({ where: { email: emailStr } });
            if (existingUser) {
              results.errors.push(`Row ${actualRowIndex}: Email already exists - ${emailStr}`);
              continue;
            }

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

            // Hash the password
            const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

            // Create the user using transaction for better error handling
            const newUser = await db.user.create({
              data: {
                email: emailStr,
                password: hashedPassword,
                firstName: String(firstName).trim(),
                lastName: String(lastName).trim(),
                phone: phone ? String(phone).trim() : null,
                address: address ? String(address).trim() : null,
                role: "TENANT",
              },
            });

            results.imported.push({
              firstName: newUser.firstName,
              lastName: newUser.lastName,
              email: newUser.email,
            });

            // Send welcome email (async, don't wait)
            emailService.sendWelcomeEmail({
              firstName: newUser.firstName,
              lastName: newUser.lastName,
              email: newUser.email,
              temporaryPassword: temporaryPassword,
            }).catch(error => {
              console.error(`Failed to send welcome email to ${emailStr}:`, error);
            });

            results.success++;
          } catch (error: unknown) {
            console.error(`Error processing row ${actualRowIndex}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.errors.push(`Row ${actualRowIndex}: ${errorMessage}`);
          }
        }

        // Small delay between chunks to prevent overwhelming the database
        if (chunkIndex < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      return json({
        success: true,
        results,
        message: `Import completed. ${results.success} guests imported successfully, ${results.errors.length} errors.`,
        progress: {
          processed: results.total,
          total: results.total,
          percentage: 100
        }
      });

    } catch (error: unknown) {
      console.error("Excel import error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return json({ error: `Failed to process Excel file: ${errorMessage}` }, { status: 500 });
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
