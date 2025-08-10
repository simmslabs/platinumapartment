# Guest Excel Import Feature

This feature allows administrators and managers to bulk import guests from Excel files (.xlsx format).

## Features

- **📊 Excel File Support**: Import guests from .xlsx files
- **📥 Template Download**: Download a pre-formatted Excel template
- **✅ Data Validation**: Validates required fields and email formats
- **🔄 Bulk Processing**: Handle multiple guests in a single import
- **📧 Welcome Emails**: Automatically sends welcome emails to imported guests
- **📋 Import Results**: Detailed feedback on success/failure for each row
- **🔒 Duplicate Prevention**: Prevents importing guests with existing emails

## How to Use

### 1. Access Import Feature
- Navigate to **Dashboard > Guests Management**
- Click the **"Import Guests"** button (Admin/Manager only)

### 2. Download Template (Recommended)
- In the import modal, click **"Download Excel Template"**
- This provides a properly formatted Excel file with sample data
- Use this as a starting point for your guest data

### 3. Prepare Your Excel File
Your Excel file must include these columns (case-insensitive):

#### Required Columns:
- **firstName**: Guest's first name
- **lastName**: Guest's last name  
- **email**: Valid email address (must be unique)

#### Optional Columns:
- **password**: Login password (defaults to "TempPass123!" if not provided)
- **phone**: Phone number in any format
- **address**: Full address

### 4. Upload and Import
- Select your prepared Excel file
- Click **"Import Guests"**
- Review the import results

## Excel File Format

### Column Headers
The system accepts various column name formats:
```
firstName, FirstName, first_name, "First Name"
lastName, LastName, last_name, "Last Name"  
email, Email, EMAIL
password, Password
phone, Phone, PHONE
address, Address, ADDRESS
```

### Sample Data Structure
```
| firstName | lastName | email                | password     | phone        | address                    |
|-----------|----------|---------------------|-------------|-------------|----------------------------|
| John      | Doe      | john.doe@email.com  | TempPass123!| +1234567890 | 123 Main St, City, State  |
| Jane      | Smith    | jane.smith@email.com| SecurePass! | +0987654321 | 456 Oak Ave, City, State  |
```

## Validation Rules

### Email Validation
- Must be a valid email format (contains @ and domain)
- Must be unique (not already in the system)
- Case-insensitive duplicate checking

### Required Fields
- **firstName**: Cannot be empty
- **lastName**: Cannot be empty
- **email**: Cannot be empty and must be valid

### Password Handling
- If not provided, defaults to "TempPass123!"
- Will be securely hashed before storage
- Sent to guests via welcome email

## Import Process

1. **File Upload**: Select and upload Excel file
2. **Data Parsing**: Extract data from Excel sheets
3. **Validation**: Check required fields and email formats
4. **Duplicate Check**: Verify emails don't already exist
5. **User Creation**: Create guest accounts in database
6. **Password Hashing**: Securely hash all passwords
7. **Welcome Emails**: Send welcome emails with login credentials
8. **Results Report**: Display import success/error summary

## Import Results

After import completion, you'll see:
- **Total Processed**: Number of rows processed
- **Successfully Imported**: Number of guests created
- **Errors**: List of validation/processing errors
- **Error Details**: Specific error messages for failed rows

### Common Errors
- "Missing required fields" - firstName, lastName, or email missing
- "Invalid email format" - Email doesn't match proper format
- "Email already exists" - Guest with this email already registered
- "Row X: [error message]" - Specific row-level errors

## Creating Test Data

Use the provided script to generate sample Excel files:

```bash
bun run scripts/create-sample-excel.js
```

This creates `sample-guests-import.xlsx` with 5 sample guests for testing.

## Security Features

- **Authentication Required**: Only Admin/Manager roles can import
- **Password Hashing**: All passwords are bcrypt hashed
- **Email Validation**: Prevents invalid email addresses
- **Duplicate Prevention**: Stops duplicate email imports
- **Error Logging**: Comprehensive error tracking

## Best Practices

### Before Import
1. **Download Template**: Use the provided template for proper formatting
2. **Validate Data**: Ensure all required fields are complete
3. **Check Emails**: Verify email addresses are valid and unique
4. **Test Small Batches**: Start with small files to test the process

### Data Preparation
1. **Clean Data**: Remove extra spaces and formatting
2. **Consistent Formatting**: Use consistent phone number formats
3. **Valid Emails**: Ensure all emails follow proper format
4. **Strong Passwords**: Provide secure passwords for guests

### After Import
1. **Review Results**: Check import summary for errors
2. **Verify Emails**: Confirm welcome emails were sent
3. **Handle Errors**: Fix and re-import any failed entries
4. **Guest Communication**: Inform guests about their new accounts

## Troubleshooting

### Common Issues

**"No file provided"**
- Ensure you've selected an Excel file before clicking import

**"Excel file is empty"**
- Check that your Excel file contains data rows (not just headers)
- Verify the first worksheet contains the guest data

**"Missing required fields"**
- Ensure firstName, lastName, and email columns exist
- Check for typos in column names
- Verify data rows are not empty

**"Invalid email format"**
- Check email addresses contain @ symbol and domain
- Remove any extra spaces around email addresses

**"Email already exists"**
- Guest with this email is already in the system
- Use different email or remove the existing guest first

### Performance Notes
- **Batch Size**: Recommended maximum 1000 guests per import
- **Processing Time**: Larger files may take several minutes
- **Memory Usage**: Very large files (>5MB) may cause timeouts

## API Endpoints

The import feature uses these internal API endpoints:

- `POST /api/guests/import` - Import guests from Excel
- `POST /api/guests/import?intent=download-template` - Download template

## File Formats Supported

- **.xlsx** - Excel 2007+ format (recommended)
- **.xls** - Legacy Excel format (limited support)

## Technical Implementation

Built using:
- **XLSX Library**: For Excel file parsing (Bun.js compatible)
- **Remix Actions**: Server-side form handling
- **Mantine UI**: File upload and modal components
- **Prisma ORM**: Database operations
- **bcrypt**: Password hashing
- **Resend**: Email service integration
