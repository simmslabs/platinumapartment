import type { LoaderFunctionArgs } from "@remix-run/node";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  subMonths, 
  subYears,
  startOfWeek,
  endOfWeek,
  startOfQuarter,
  endOfQuarter,
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  subQuarters,
} from "date-fns";
import * as XLSX from "xlsx";
import { requireUserId, getUser } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const user = await getUser(request);

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    throw new Response("Unauthorized", { status: 403 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "thisMonth";
  const format_type = url.searchParams.get("format") || "csv";

  // Calculate date ranges (same logic as reports)
  let startDate: Date;
  let endDate: Date;
  
  switch (period) {
    case "today":
      startDate = startOfDay(new Date());
      endDate = endOfDay(new Date());
      break;
    case "yesterday": {
      const yesterday = subDays(new Date(), 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
      break;
    }
    case "thisWeek":
      startDate = startOfWeek(new Date());
      endDate = endOfWeek(new Date());
      break;
    case "lastWeek": {
      const lastWeek = subWeeks(new Date(), 1);
      startDate = startOfWeek(lastWeek);
      endDate = endOfWeek(lastWeek);
      break;
    }
    case "thisMonth":
      startDate = startOfMonth(new Date());
      endDate = endOfMonth(new Date());
      break;
    case "lastMonth": {
      const lastMonth = subMonths(new Date(), 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      break;
    }
    case "thisQuarter":
      startDate = startOfQuarter(new Date());
      endDate = endOfQuarter(new Date());
      break;
    case "lastQuarter": {
      const lastQuarter = subQuarters(new Date(), 1);
      startDate = startOfQuarter(lastQuarter);
      endDate = endOfQuarter(lastQuarter);
      break;
    }
    case "thisYear":
      startDate = startOfYear(new Date());
      endDate = endOfYear(new Date());
      break;
    case "lastYear": {
      const lastYear = subYears(new Date(), 1);
      startDate = startOfYear(lastYear);
      endDate = endOfYear(lastYear);
      break;
    }
    default:
      startDate = startOfMonth(new Date());
      endDate = endOfMonth(new Date());
  }

  // Get all data for export
  const [payments, securityDeposits, bookings] = await Promise.all([
    db.payment.findMany({
      where: {
        paidAt: { gte: startDate, lte: endDate },
        status: "COMPLETED",
      },
      include: {
        booking: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            room: { 
              select: { 
                number: true, 
                type: {
                  select: {
                    displayName: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
    db.securityDeposit.findMany({
      where: {
        paidAt: { gte: startDate, lte: endDate },
      },
      include: {
        booking: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            room: { 
              select: { 
                number: true, 
                type: {
                  select: {
                    displayName: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
    db.booking.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { not: "CANCELLED" },
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        room: { 
          select: { 
            number: true, 
            type: {
              select: {
                displayName: true,
                name: true,
              },
            },
          },
        },
        payment: true,
        securityDeposit: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Prepare data for export
  const paymentData = payments.map(payment => ({
    "Transaction ID": payment.id,
    "Date": format(payment.paidAt || payment.createdAt, "yyyy-MM-dd HH:mm"),
    "Tenant Name": `${payment.booking.user.firstName} ${payment.booking.user.lastName}`,
    "Tenant Email": payment.booking.user.email,
    "Room Number": payment.booking.room.number,
    "Room Type": payment.booking.room.type.displayName,
    "Amount": payment.amount,
    "Method": payment.method.replace("_", " "),
    "Status": payment.status,
    "Reference": payment.id,
  }));

  const depositData = securityDeposits.map(deposit => ({
    "Deposit ID": deposit.id,
    "Date": format(deposit.paidAt || deposit.createdAt, "yyyy-MM-dd HH:mm"),
    "Tenant Name": `${deposit.booking.user.firstName} ${deposit.booking.user.lastName}`,
    "Tenant Email": deposit.booking.user.email,
    "Room Number": deposit.booking.room.number,
    "Room Type": deposit.booking.room.type.displayName,
    "Amount": deposit.amount,
    "Status": deposit.status,
    "Refund Amount": deposit.refundAmount || 0,
    "Deduction Amount": deposit.deductionAmount || 0,
    "Reason": deposit.deductionReason || "",
  }));

  const bookingData = bookings.map(booking => ({
    "Booking ID": booking.id,
    "Created Date": format(booking.createdAt, "yyyy-MM-dd HH:mm"),
    "Check-in": format(booking.checkIn, "yyyy-MM-dd"),
    "Check-out": format(booking.checkOut, "yyyy-MM-dd"),
    "Tenant Name": `${booking.user.firstName} ${booking.user.lastName}`,
    "Tenant Email": booking.user.email,
    "Room Number": booking.room.number,
    "Room Type": booking.room.type.displayName,
    "Total Amount": booking.totalAmount,
    "Status": booking.status,
    "Payment Status": booking.payment?.status || "PENDING",
    "Security Deposit": booking.securityDeposit?.amount || 0,
  }));

  // Calculate summary data
  const summary = {
    "Report Period": period.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
    "Start Date": format(startDate, "yyyy-MM-dd"),
    "End Date": format(endDate, "yyyy-MM-dd"),
    "Total Payments": payments.length,
    "Total Payment Amount": payments.reduce((sum, p) => sum + p.amount, 0),
    "Total Security Deposits": securityDeposits.length,
    "Total Deposit Amount": securityDeposits.reduce((sum, d) => sum + d.amount, 0),
    "Total Bookings": bookings.length,
    "Total Booking Revenue": bookings.reduce((sum, b) => sum + b.totalAmount, 0),
    "Generated On": format(new Date(), "yyyy-MM-dd HH:mm:ss"),
  };

  const summaryData = Object.entries(summary).map(([key, value]) => ({
    "Metric": key,
    "Value": value,
  }));

  if (format_type === "excel") {
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    
    // Add summary sheet
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    
    // Add payments sheet
    const paymentSheet = XLSX.utils.json_to_sheet(paymentData);
    XLSX.utils.book_append_sheet(workbook, paymentSheet, "Payments");
    
    // Add deposits sheet
    const depositSheet = XLSX.utils.json_to_sheet(depositData);
    XLSX.utils.book_append_sheet(workbook, depositSheet, "Security Deposits");
    
    // Add bookings sheet
    const bookingSheet = XLSX.utils.json_to_sheet(bookingData);
    XLSX.utils.book_append_sheet(workbook, bookingSheet, "Bookings");

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    const filename = `apartment_report_${period}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } else {
    // Generate CSV format (combined data)
    const csvData = [
      ...summaryData.map(row => ({ Type: "Summary", ...row, "Tenant Name": "", "Room Number": "", Amount: "" })),
      { Type: "---", Metric: "---", Value: "---", "Tenant Name": "---", "Room Number": "---", Amount: "---" },
      ...paymentData.map(row => ({ Type: "Payment", Metric: row["Transaction ID"], Value: row["Date"], "Tenant Name": row["Tenant Name"], "Room Number": row["Room Number"], Amount: row["Amount"] })),
      { Type: "---", Metric: "---", Value: "---", "Tenant Name": "---", "Room Number": "---", Amount: "---" },
      ...depositData.map(row => ({ Type: "Security Deposit", Metric: row["Deposit ID"], Value: row["Date"], "Tenant Name": row["Tenant Name"], "Room Number": row["Room Number"], Amount: row["Amount"] })),
    ];

    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(","))
    ].join("\n");

    const filename = `apartment_report_${period}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
}
