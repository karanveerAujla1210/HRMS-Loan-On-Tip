const { createClient } = require("@supabase/supabase-js");

const url = "https://huyuayotmwthjisguemq.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1eXVheW90bXd0aGppc2d1ZW1xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzI0MDkzNCwiZXhwIjoyMTAyODE2OTM0fQ.hueQvJCxSgwWgcjmyNZ351B7mAsm7sGIlyGVtHOdI_I";

const supabase = createClient(url, serviceKey);

const rawEmployees = [
  { code: 'EMP-000001', name: 'System Admin', email: 'admin@loanontip.com', manager: 'System', dept: 'System', status: 'ACTIVE', role: 'SUPER_ADMIN' },
  { code: 'EMP-000003', name: 'Naveen Bhilwara', email: 'naveen.bhilwara@loanontip.com', manager: 'Arjan Gandhi', dept: 'Management', status: 'ACTIVE', role: 'MANAGER' },
  { code: 'EMP002', name: 'Arjan Gandhi', email: 'arjan.gandhi@loanontip.com', manager: 'CEO', dept: 'Management', status: 'ACTIVE', role: 'SUPER_ADMIN' },
  { code: 'EMP003', name: 'Ankit Kumar', email: 'ankit.kumar@loanontip.com', manager: 'Arjan Gandhi', dept: 'Management', status: 'ACTIVE', role: 'MANAGER' },
  { code: 'EMP004', name: 'Anand Kumar', email: 'anand@loanontip.com', manager: 'Arjan Gandhi', dept: 'Management', status: 'ACTIVE', role: 'MANAGER' },
  { code: 'EMP005', name: 'Roshini', email: 'roshni@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP007', name: 'Suryanshu Mishra', email: 'suryanshu.mishra@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'INACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP008', name: 'Sujeet Pandey', email: 'sujeet.pandey@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP009', name: 'Jyoti Rana', email: 'jyoti.rana@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP011', name: 'Sachina', email: 'sachin@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP012', name: 'K Pushpa', email: 'k.pushpa@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP013', name: 'Ananya', email: 'ananya@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP016', name: 'Chahat Choudhary', email: 'chahat.choudhary@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP017', name: 'Pooja Negi', email: 'pooja.negi@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP019', name: 'Rachna', email: 'rachna.singh@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP020', name: 'Mohit', email: 'mohit@loanontip.com', manager: 'Mudit Bhardwaj', dept: 'Collection', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP021', name: 'Mudit Bhardwaj', email: 'mudit.bhardwaj@loanontip.com', manager: 'Arjan Gandhi', dept: 'Management', status: 'ACTIVE', role: 'MANAGER' },
  { code: 'EMP022', name: 'Anuradha', email: 'anuradha@loanontip.com', manager: 'Kishan Kumar', dept: 'Credit', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP023', name: 'Kishan Kumar', email: 'kishan.kumar@loanontip.com', manager: 'Arjan Gandhi', dept: 'Management', status: 'ACTIVE', role: 'MANAGER' },
  { code: 'EMP024', name: 'Tanvi', email: 'tanvi.singh@loanontip.com', manager: 'Kishan Kumar', dept: 'Credit', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP026', name: 'Shivani Joshi', email: 'shivani.joshi@loanontip.com', manager: 'Kishan Kumar', dept: 'Credit', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP027', name: 'Deepak Kumar', email: 'deepak.kumar@loanontip.com', manager: 'Kishan Kumar', dept: 'Credit', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP028', name: 'Garishma Malhotra', email: 'garishma.malhotra@loanontip.com', manager: 'Kishan Kumar', dept: 'Credit', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP029', name: 'Pooja', email: 'pooja@loanontip.com', manager: 'Kishan Kumar', dept: 'Credit', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP030', name: 'Megha Singh', email: 'megha.singh@loanontip.com', manager: 'Arjan Gandhi', dept: 'HR', status: 'ACTIVE', role: 'HR_ADMIN' },
  { code: 'EMP033', name: 'Tannu Singh', email: 'tannu.singh@loanontip.com', manager: 'Kishan Kumar', dept: 'Credit', status: 'ACTIVE', role: 'EMPLOYEE' },
  { code: 'EMP034', name: 'Muskan', email: 'muskan@loanontip.com', manager: 'Kishan Kumar', dept: 'Credit', status: 'ACTIVE', role: 'EMPLOYEE' },
];

async function seed() {
  console.log("Seeding companies, departments, roles, and employees...\n");

  const companyId = "00000000-0000-0000-0000-000000000001";

  // Fetch existing departments
  const { data: deptRows } = await supabase.from("departments").select("id, name, department_code");
  const deptMap = {};
  (deptRows || []).forEach((d) => {
    deptMap[d.name.toLowerCase()] = d.id;
    deptMap[d.department_code.toLowerCase()] = d.id;
  });
  deptMap["system"] = deptMap["technology"] || deptMap["management"];
  deptMap["hr"] = deptMap["human resources"] || deptMap["hr"];

  console.log("Mapped departments:", Object.keys(deptMap).length);

  for (const item of rawEmployees) {
    const parts = item.name.split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || "";
    const deptId = deptMap[item.dept.toLowerCase()] || deptMap["management"];

    let { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("employee_code", item.code)
      .maybeSingle();

    if (!emp) {
      const { data: createdEmp } = await supabase
        .from("employees")
        .insert({
          company_id: companyId,
          employee_code: item.code,
          first_name: firstName,
          last_name: lastName,
          official_email: item.email,
          department_id: deptId,
          employment_status: item.status,
          joining_date: "2024-01-15",
        })
        .select("id")
        .single();
      emp = createdEmp;
    } else {
      await supabase
        .from("employees")
        .update({
          first_name: firstName,
          last_name: lastName,
          official_email: item.email,
          department_id: deptId,
          employment_status: item.status,
        })
        .eq("id", emp.id);
    }

    if (item.email) {
      const { data: usersList } = await supabase.auth.admin.listUsers();
      const existingUser = (usersList?.users || []).find((u) => u.email?.toLowerCase() === item.email.toLowerCase());
      let authUserId;

      if (existingUser) {
        authUserId = existingUser.id;
        await supabase.auth.admin.updateUserById(authUserId, {
          password: "LOT@123",
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName, role: item.role, department: item.dept, manager: item.manager }
        });
      } else {
        const { data: newUser } = await supabase.auth.admin.createUser({
          email: item.email,
          password: "LOT@123",
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName, role: item.role, department: item.dept, manager: item.manager },
        });
        authUserId = newUser?.user?.id;
      }

      if (authUserId && emp?.id) {
        await supabase.from("profiles").upsert(
          { auth_user_id: authUserId, employee_id: emp.id, company_id: companyId, email: item.email },
          { onConflict: "auth_user_id" }
        );
      }
    }

    console.log(`Synced: ${item.code} - ${item.name} (${item.dept}) -> Password: LOT@123`);
  }

  console.log("\nAll 27 Employees Successfully Seeded & Synced!");
}

seed().catch(console.error);
