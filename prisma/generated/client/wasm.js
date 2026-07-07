
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ClinicScalarFieldEnum = {
  id: 'id',
  name: 'name',
  username: 'username',
  ownerName: 'ownerName',
  ownerEmail: 'ownerEmail',
  whatsappNumber: 'whatsappNumber',
  phone: 'phone',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  district: 'district',
  city: 'city',
  state: 'state',
  country: 'country',
  pincode: 'pincode',
  gstNumber: 'gstNumber',
  emergencyContact: 'emergencyContact',
  doctorCount: 'doctorCount',
  status: 'status',
  onboardingStep: 'onboardingStep',
  packageId: 'packageId',
  packageStartsAt: 'packageStartsAt',
  packageExpiresAt: 'packageExpiresAt',
  isTrialUsed: 'isTrialUsed',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LandingPageScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  tagline: 'tagline',
  whatsapp: 'whatsapp',
  email: 'email',
  facebook: 'facebook',
  instagram: 'instagram',
  about: 'about',
  established: 'established',
  patientsServed: 'patientsServed',
  experience: 'experience',
  mapUrl: 'mapUrl',
  directionsUrl: 'directionsUrl',
  reviews: 'reviews',
  gallery: 'gallery',
  services: 'services',
  faqs: 'faqs',
  timetable: 'timetable',
  headerImage: 'headerImage',
  aboutImage: 'aboutImage',
  gmbUrl: 'gmbUrl',
  logo: 'logo',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SubscriptionPackageScalarFieldEnum = {
  id: 'id',
  name: 'name',
  price: 'price',
  durationInDays: 'durationInDays',
  isActive: 'isActive',
  maxDoctors: 'maxDoctors',
  maxPatients: 'maxPatients',
  maxAppointments: 'maxAppointments',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  username: 'username',
  phone: 'phone',
  passwordHash: 'passwordHash',
  fullName: 'fullName',
  dob: 'dob',
  age: 'age',
  gender: 'gender',
  role: 'role',
  clinicId: 'clinicId',
  profileImage: 'profileImage',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DepartmentScalarFieldEnum = {
  id: 'id',
  departmentCode: 'departmentCode',
  name: 'name',
  description: 'description',
  iconUrl: 'iconUrl',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DesignationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  description: 'description',
  status: 'status',
  clinicId: 'clinicId',
  departmentId: 'departmentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StaffScalarFieldEnum = {
  id: 'id',
  staffCode: 'staffCode',
  fullName: 'fullName',
  role: 'role',
  profileImage: 'profileImage',
  phone: 'phone',
  email: 'email',
  dob: 'dob',
  gender: 'gender',
  bloodGroup: 'bloodGroup',
  address1: 'address1',
  address2: 'address2',
  country: 'country',
  state: 'state',
  city: 'city',
  pincode: 'pincode',
  dateOfJoining: 'dateOfJoining',
  status: 'status',
  designationId: 'designationId',
  departmentId: 'departmentId',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DoctorScalarFieldEnum = {
  id: 'id',
  doctorCode: 'doctorCode',
  fullName: 'fullName',
  username: 'username',
  phone: 'phone',
  alternateMobile: 'alternateMobile',
  email: 'email',
  dob: 'dob',
  yearOfExperience: 'yearOfExperience',
  medicalLicenseNumber: 'medicalLicenseNumber',
  languagesSpoken: 'languagesSpoken',
  bloodGroup: 'bloodGroup',
  gender: 'gender',
  bio: 'bio',
  featureOnWebsite: 'featureOnWebsite',
  profileImage: 'profileImage',
  address1: 'address1',
  address2: 'address2',
  country: 'country',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  appointmentType: 'appointmentType',
  acceptBookingsInAdvance: 'acceptBookingsInAdvance',
  appointmentDuration: 'appointmentDuration',
  consultationCharge: 'consultationCharge',
  maxBookingsPerSlot: 'maxBookingsPerSlot',
  displayOnBookingPage: 'displayOnBookingPage',
  educations: 'educations',
  awards: 'awards',
  certifications: 'certifications',
  schedules: 'schedules',
  status: 'status',
  departmentId: 'departmentId',
  maritalStatus: 'maritalStatus',
  qualification: 'qualification',
  signatureImage: 'signatureImage',
  medicalRegCertificate: 'medicalRegCertificate',
  qualificationCertificate: 'qualificationCertificate',
  aadhaarCard: 'aadhaarCard',
  aadhaarCardBack: 'aadhaarCardBack',
  panCard: 'panCard',
  followUpEnabled: 'followUpEnabled',
  followUpValidityDays: 'followUpValidityDays',
  freeFollowUpLimit: 'freeFollowUpLimit',
  followUpFee: 'followUpFee',
  designationId: 'designationId',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PatientScalarFieldEnum = {
  id: 'id',
  patientCode: 'patientCode',
  firstName: 'firstName',
  middleName: 'middleName',
  lastName: 'lastName',
  profileImage: 'profileImage',
  phone: 'phone',
  alternateMobile: 'alternateMobile',
  email: 'email',
  dob: 'dob',
  age: 'age',
  gender: 'gender',
  bloodGroup: 'bloodGroup',
  maritalStatus: 'maritalStatus',
  occupation: 'occupation',
  aadhaarNumber: 'aadhaarNumber',
  passportNumber: 'passportNumber',
  referredBy: 'referredBy',
  emergencyContactName: 'emergencyContactName',
  emergencyContactRelation: 'emergencyContactRelation',
  emergencyContactPhone: 'emergencyContactPhone',
  status: 'status',
  address1: 'address1',
  address2: 'address2',
  country: 'country',
  state: 'state',
  city: 'city',
  pincode: 'pincode',
  lastVisitedAt: 'lastVisitedAt',
  vitals: 'vitals',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppointmentScalarFieldEnum = {
  id: 'id',
  appointmentCode: 'appointmentCode',
  patientId: 'patientId',
  doctorId: 'doctorId',
  departmentId: 'departmentId',
  scheduledAt: 'scheduledAt',
  endAt: 'endAt',
  mode: 'mode',
  appointmentType: 'appointmentType',
  status: 'status',
  reason: 'reason',
  location: 'location',
  clinicId: 'clinicId',
  parentAppointmentId: 'parentAppointmentId',
  isFollowUp: 'isFollowUp',
  followUpStatus: 'followUpStatus',
  paymentStatus: 'paymentStatus',
  followUpPaymentStatus: 'followUpPaymentStatus',
  serviceIds: 'serviceIds',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ServiceScalarFieldEnum = {
  id: 'id',
  serviceName: 'serviceName',
  departmentId: 'departmentId',
  price: 'price',
  duration: 'duration',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SpecializationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  image: 'image',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.HolidayScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  date: 'date',
  endDate: 'endDate',
  dayName: 'dayName',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PayrollScalarFieldEnum = {
  id: 'id',
  staffId: 'staffId',
  doctorId: 'doctorId',
  netSalary: 'netSalary',
  basicSalary: 'basicSalary',
  da: 'da',
  hra: 'hra',
  conveyance: 'conveyance',
  medicalAllowance: 'medicalAllowance',
  otherEarnings: 'otherEarnings',
  tds: 'tds',
  esi: 'esi',
  pf: 'pf',
  profTax: 'profTax',
  labourWelfare: 'labourWelfare',
  otherDeductions: 'otherDeductions',
  status: 'status',
  salaryDate: 'salaryDate',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  name: 'name',
  category: 'category',
  amount: 'amount',
  date: 'date',
  purchasedBy: 'purchasedBy',
  paymentMethod: 'paymentMethod',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ExpenseCategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClinicRoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  permissions: 'permissions',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AttendanceScalarFieldEnum = {
  id: 'id',
  date: 'date',
  employeeId: 'employeeId',
  employeeType: 'employeeType',
  status: 'status',
  markedBy: 'markedBy',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeaveTypeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  quota: 'quota',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeaveScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  employeeId: 'employeeId',
  employeeType: 'employeeType',
  leaveTypeId: 'leaveTypeId',
  leaveTypeName: 'leaveTypeName',
  subject: 'subject',
  evidenceFiles: 'evidenceFiles',
  isPaid: 'isPaid',
  startDate: 'startDate',
  endDate: 'endDate',
  days: 'days',
  workingDays: 'workingDays',
  reason: 'reason',
  status: 'status',
  rejectRemark: 'rejectRemark',
  adminNotes: 'adminNotes',
  appliedOn: 'appliedOn',
  completedAt: 'completedAt',
  withdrawnAt: 'withdrawnAt',
  cancelledAt: 'cancelledAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkingDaysConfigScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  offDays: 'offDays',
  schedules: 'schedules',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PrescriptionScalarFieldEnum = {
  id: 'id',
  prescriptionCode: 'prescriptionCode',
  patientId: 'patientId',
  doctorId: 'doctorId',
  appointmentId: 'appointmentId',
  departmentId: 'departmentId',
  advice: 'advice',
  followUpDate: 'followUpDate',
  followUpNotes: 'followUpNotes',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PrescriptionMedicineScalarFieldEnum = {
  id: 'id',
  prescriptionId: 'prescriptionId',
  medicineName: 'medicineName',
  dosage: 'dosage',
  frequency: 'frequency',
  duration: 'duration',
  timings: 'timings',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  invoiceCode: 'invoiceCode',
  patientId: 'patientId',
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  tax: 'tax',
  discount: 'discount',
  subTotal: 'subTotal',
  totalAmount: 'totalAmount',
  paymentMethod: 'paymentMethod',
  paymentStatus: 'paymentStatus',
  otherInfo: 'otherInfo',
  clinicId: 'clinicId',
  appointmentId: 'appointmentId',
  labBookingId: 'labBookingId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceItemScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  serviceId: 'serviceId',
  description: 'description',
  quantity: 'quantity',
  unitCost: 'unitCost',
  amount: 'amount',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  price: 'price',
  key: 'key',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  clinicId: 'clinicId',
  type: 'type',
  title: 'title',
  message: 'message',
  targetRole: 'targetRole',
  targetUserId: 'targetUserId',
  link: 'link',
  isRead: 'isRead',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SystemSettingScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  createdAt: 'createdAt'
};

exports.Prisma.DemoBookingScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  phone: 'phone',
  location: 'location',
  clinicName: 'clinicName',
  dateTime: 'dateTime',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TicketScalarFieldEnum = {
  id: 'id',
  ticketCode: 'ticketCode',
  subject: 'subject',
  description: 'description',
  priority: 'priority',
  status: 'status',
  clinicId: 'clinicId',
  userId: 'userId',
  userName: 'userName',
  userEmail: 'userEmail',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TodoScalarFieldEnum = {
  id: 'id',
  title: 'title',
  priority: 'priority',
  status: 'status',
  taskDate: 'taskDate',
  clinicId: 'clinicId',
  userId: 'userId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NoteScalarFieldEnum = {
  id: 'id',
  title: 'title',
  content: 'content',
  priority: 'priority',
  noteDate: 'noteDate',
  clinicId: 'clinicId',
  userId: 'userId',
  appointmentId: 'appointmentId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LabCategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LabTestScalarFieldEnum = {
  id: 'id',
  testCode: 'testCode',
  name: 'name',
  shortName: 'shortName',
  description: 'description',
  price: 'price',
  homeCollectionCharge: 'homeCollectionCharge',
  duration: 'duration',
  preparationInfo: 'preparationInfo',
  assignment: 'assignment',
  assignedDoctors: 'assignedDoctors',
  assignedStaff: 'assignedStaff',
  status: 'status',
  schedules: 'schedules',
  isSlotBookingEnabled: 'isSlotBookingEnabled',
  slotDuration: 'slotDuration',
  maxBookingsPerSlot: 'maxBookingsPerSlot',
  categoryId: 'categoryId',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LabBookingScalarFieldEnum = {
  id: 'id',
  bookingCode: 'bookingCode',
  patientId: 'patientId',
  testId: 'testId',
  scheduledAt: 'scheduledAt',
  status: 'status',
  paymentStatus: 'paymentStatus',
  paymentMethod: 'paymentMethod',
  discount: 'discount',
  tax: 'tax',
  totalAmount: 'totalAmount',
  invoiceNo: 'invoiceNo',
  sessionSlot: 'sessionSlot',
  assignedUserId: 'assignedUserId',
  remarks: 'remarks',
  referredBy: 'referredBy',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PharmacyCategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MedicineScalarFieldEnum = {
  id: 'id',
  medicineName: 'medicineName',
  genericName: 'genericName',
  brandName: 'brandName',
  categoryId: 'categoryId',
  manufacturer: 'manufacturer',
  medicineCode: 'medicineCode',
  hsnCode: 'hsnCode',
  description: 'description',
  purchasePrice: 'purchasePrice',
  sellingPrice: 'sellingPrice',
  gst: 'gst',
  mrp: 'mrp',
  openingStock: 'openingStock',
  stockIn: 'stockIn',
  stockOut: 'stockOut',
  minimumStockAlert: 'minimumStockAlert',
  unit: 'unit',
  batchNumber: 'batchNumber',
  manufacturingDate: 'manufacturingDate',
  expiryDate: 'expiryDate',
  prescriptionRequired: 'prescriptionRequired',
  status: 'status',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PharmacyInvoiceScalarFieldEnum = {
  id: 'id',
  invoiceNo: 'invoiceNo',
  patientId: 'patientId',
  customerName: 'customerName',
  customerPhone: 'customerPhone',
  invoiceDate: 'invoiceDate',
  tax: 'tax',
  discount: 'discount',
  subTotal: 'subTotal',
  totalAmount: 'totalAmount',
  paymentMethod: 'paymentMethod',
  paymentStatus: 'paymentStatus',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PharmacyInvoiceItemScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  medicineId: 'medicineId',
  medicineName: 'medicineName',
  quantity: 'quantity',
  unitCost: 'unitCost',
  gst: 'gst',
  amount: 'amount',
  clinicId: 'clinicId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.ClinicStatus = exports.$Enums.ClinicStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  TRIAL: 'TRIAL',
  TRIAL_EXPIRED: 'TRIAL_EXPIRED',
  TRIAL_COMPLETED_NOT_UPGRADED: 'TRIAL_COMPLETED_NOT_UPGRADED',
  UPGRADED: 'UPGRADED',
  FAILED: 'FAILED'
};

exports.Role = exports.$Enums.Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  PATIENT: 'PATIENT',
  PORTER: 'PORTER',
  STAFF: 'STAFF'
};

exports.Prisma.ModelName = {
  Clinic: 'Clinic',
  LandingPage: 'LandingPage',
  SubscriptionPackage: 'SubscriptionPackage',
  User: 'User',
  Department: 'Department',
  Designation: 'Designation',
  Staff: 'Staff',
  Doctor: 'Doctor',
  Patient: 'Patient',
  Appointment: 'Appointment',
  Service: 'Service',
  Specialization: 'Specialization',
  Holiday: 'Holiday',
  Payroll: 'Payroll',
  Expense: 'Expense',
  ExpenseCategory: 'ExpenseCategory',
  ClinicRole: 'ClinicRole',
  Attendance: 'Attendance',
  LeaveType: 'LeaveType',
  Leave: 'Leave',
  WorkingDaysConfig: 'WorkingDaysConfig',
  Prescription: 'Prescription',
  PrescriptionMedicine: 'PrescriptionMedicine',
  Invoice: 'Invoice',
  InvoiceItem: 'InvoiceItem',
  Product: 'Product',
  Notification: 'Notification',
  SystemSetting: 'SystemSetting',
  DemoBooking: 'DemoBooking',
  Ticket: 'Ticket',
  Todo: 'Todo',
  Note: 'Note',
  LabCategory: 'LabCategory',
  LabTest: 'LabTest',
  LabBooking: 'LabBooking',
  PharmacyCategory: 'PharmacyCategory',
  Medicine: 'Medicine',
  PharmacyInvoice: 'PharmacyInvoice',
  PharmacyInvoiceItem: 'PharmacyInvoiceItem'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
