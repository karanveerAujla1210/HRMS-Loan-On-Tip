import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

function getWorkingDaysInMonthUpToToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  
  const workingDays: Date[] = [];
  
  for (let day = 1; day <= todayDate; day++) {
    const d = new Date(year, month, day);
    // Ignore weekends (0 = Sunday, 6 = Saturday)
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      workingDays.push(d);
    }
  }
  
  return workingDays;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("employees")
      .select("company_id")
      .eq("user_id", session.user.id)
      .single();

    if (!profile?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 400 });
    }

    // Get all active employees
    const { data: activeEmployees, error: empError } = await supabase
      .from("employees")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("status", "ACTIVE");

    if (empError) throw empError;
    if (!activeEmployees || activeEmployees.length === 0) {
      return NextResponse.json({ message: "No active employees found." });
    }

    const workingDays = getWorkingDaysInMonthUpToToday();
    const recordsToInsert = [];

    for (const emp of activeEmployees) {
      for (const day of workingDays) {
        // Format date to YYYY-MM-DD
        const dateStr = day.toISOString().slice(0, 10);
        
        // Default 9 to 5
        const checkIn = new Date(day);
        checkIn.setHours(9, 0, 0, 0);
        
        const checkOut = new Date(day);
        checkOut.setHours(17, 0, 0, 0);
        
        recordsToInsert.push({
          employee_id: emp.id,
          company_id: profile.company_id,
          attendance_date: dateStr,
          check_in_at: checkIn.toISOString(),
          check_out_at: checkOut.toISOString(),
          worked_minutes: 480, // 8 hours
          status: "PRESENT",
          source: "MANUAL",
          is_manual_adjustment: true,
          adjustment_reason: "Bulk marked by HR"
        });
      }
    }

    // Insert ignoring duplicates (on conflict do nothing)
    const { error: insertError } = await supabase
      .from("attendance")
      .upsert(recordsToInsert, { 
        onConflict: 'employee_id,attendance_date', 
        ignoreDuplicates: true 
      });

    if (insertError) throw insertError;

    return NextResponse.json({ message: `Successfully processed ${recordsToInsert.length} attendance records.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
