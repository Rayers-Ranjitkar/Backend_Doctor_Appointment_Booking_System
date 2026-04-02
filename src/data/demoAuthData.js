// Demo users → used for seeding initial data (for testing/demo purposes)

export const demoUsers = [
  //  Patient Users
  {
    id: 'u_patient_1',
    role: 'patient',
    name: 'Alex Johnson',
    username: 'alexjohnson',
    email: 'alex@norvicdemo.com',
    phone: '+977-9800000001',
    profileId: 'p1', // linked Patient profile
    password: 'Patient@123',
  },
  {
    id: 'u_patient_2',
    role: 'patient',
    name: 'Maria Garcia',
    username: 'mariagarcia',
    email: 'maria@norvicdemo.com',
    phone: '+977-9800000002',
    profileId: 'p2',
    password: 'Patient@123',
  },

  //  Doctor Users
  {
    id: 'u_doctor_1',
    role: 'doctor',
    name: 'Dr. James Wilson',
    username: 'drjames',
    email: 'james@norvicdemo.com',
    phone: '+977-9801000001',
    profileId: 'd1', // linked Doctor profile
    password: 'Doctor@123',
  },
  {
    id: 'u_doctor_2',
    role: 'doctor',
    name: 'Dr. Sarah Chen',
    username: 'drsarah',
    email: 'sarah@norvicdemo.com',
    phone: '+977-9801000002',
    profileId: 'd2',
    password: 'Doctor@123',
  },
  {
    id: 'u_doctor_3',
    role: 'doctor',
    name: 'Dr. Emily Rodriguez',
    username: 'dremily',
    email: 'emily@norvicdemo.com',
    phone: '+977-9801000003',
    profileId: 'd3',
    password: 'Doctor@123',
  },

  //  Admin Users
  {
    id: 'u_admin_1',
    role: 'admin',
    name: 'Aarav Shrestha',
    username: 'adminmain',
    email: 'admin@norvicdemo.com',
    phone: '+977-9802000001',
    profileId: null, // admins don't have profile
    password: 'Admin@123',
  },
  {
    id: 'u_admin_2',
    role: 'admin',
    name: 'Nisha Karki',
    username: 'adminops',
    email: 'ops@norvicdemo.com',
    phone: '+977-9802000002',
    profileId: null,
    password: 'Admin@123',
  },
];