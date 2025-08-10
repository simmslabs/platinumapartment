#!/usr/bin/env node
/**
 * Test script to create a sample Excel file for guest import
 * Usage: bun run scripts/create-sample-excel.js
 */

import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';
import { join } from 'path';

function createSampleExcel() {
  console.log('🚀 Creating sample Excel file for guest import...');

  // Sample guest data
  const sampleGuests = [
    {
      firstName: "John",
      lastName: "Doe", 
      email: "john.doe@example.com",
      password: "TempPass123!",
      phone: "+1234567890",
      address: "123 Main Street, New York, NY 10001"
    },
    {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com", 
      password: "SecurePass456!",
      phone: "+0987654321", 
      address: "456 Oak Avenue, Los Angeles, CA 90210"
    },
    {
      firstName: "Michael",
      lastName: "Johnson",
      email: "mike.johnson@example.com",
      password: "StrongPass789!",
      phone: "+1122334455",
      address: "789 Pine Road, Chicago, IL 60601"
    },
    {
      firstName: "Sarah",
      lastName: "Davis", 
      email: "sarah.davis@example.com",
      password: "SafePass321!",
      phone: "+5566778899",
      address: "321 Elm Street, Houston, TX 77001"
    },
    {
      firstName: "David",
      lastName: "Wilson",
      email: "david.wilson@example.com",
      password: "MyPass654!",
      phone: "+9988776655",
      address: "654 Maple Drive, Phoenix, AZ 85001"
    }
  ];

  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleGuests);

    // Set column widths for better readability
    const colWidths = [
      { wch: 15 }, // firstName
      { wch: 15 }, // lastName
      { wch: 30 }, // email
      { wch: 15 }, // password
      { wch: 15 }, // phone
      { wch: 40 }, // address
    ];
    worksheet['!cols'] = colWidths;

    // Add some styling (headers)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } }
      };
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Guests");

    // Write file
    const fileName = 'sample-guests-import.xlsx';
    const filePath = join(process.cwd(), fileName);
    XLSX.writeFile(workbook, filePath);

    console.log(`✅ Sample Excel file created: ${fileName}`);
    console.log(`📁 Location: ${filePath}`);
    console.log(`👥 Contains ${sampleGuests.length} sample guests`);
    console.log('');
    console.log('📋 Column structure:');
    console.log('   - firstName: Guest first name');
    console.log('   - lastName: Guest last name'); 
    console.log('   - email: Guest email address (must be unique)');
    console.log('   - password: Login password (will be hashed)');
    console.log('   - phone: Phone number (optional)');
    console.log('   - address: Full address (optional)');
    console.log('');
    console.log('🔧 You can modify this file and use it to test the import feature!');

  } catch (error) {
    console.error('❌ Error creating Excel file:', error);
  }
}

// Run the script
createSampleExcel();
