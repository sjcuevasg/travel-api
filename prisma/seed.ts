import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from '../src/config/prisma'

async function main() {
  console.log('🌱 Iniciando seed...')

  // ─── USUARIOS ────────────────────────────────────────────────────────────────
  // upsert: si el email ya existe actualiza nada, si no existe lo crea.
  // Esto hace que el seed sea idempotente: puedes correrlo N veces sin duplicar.

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@empresa.com' },
    update: {},
    create: {
      name:     'Admin Principal',
      email:    'admin@empresa.com',
      password: await bcrypt.hash('Admin1234!', 12),
      role:     'ADMIN',
    },
  })

  const manager = await prisma.user.upsert({
    where:  { email: 'manager@empresa.com' },
    update: {},
    create: {
      name:     'Carlos Manager',
      email:    'manager@empresa.com',
      password: await bcrypt.hash('Manager1234!', 12),
      role:     'MANAGER',
    },
  })

  await prisma.user.upsert({
    where:  { email: 'empleado@empresa.com' },
    update: {},
    create: {
      name:     'Ana Empleada',
      email:    'empleado@empresa.com',
      password: await bcrypt.hash('Empleado1234!', 12),
      role:     'EMPLOYEE',
    },
  })

  console.log('✅ Usuarios creados')

  // ─── VIAJES ───────────────────────────────────────────────────────────────────
  // Solo crear viajes de demo si la tabla está vacía para evitar duplicados.
  const tripCount = await prisma.trip.count()
  if (tripCount > 0) {
    console.log('ℹ️  Viajes ya existen, omitiendo creación de viajes demo')
    return
  }

  const trip1 = await prisma.trip.create({
    data: {
      title:       'Conferencia Tech Lima 2026',
      destination: 'Lima, Perú',
      startDate:   new Date('2026-07-15'),
      endDate:     new Date('2026-07-18'),
      status:      'APPROVED',
      description: 'Asistencia a la conferencia anual de tecnología en Lima.',
      budget:      2500,
      managerId:   manager.id,
    },
  })

  const trip2 = await prisma.trip.create({
    data: {
      title:       'Reunión de Ventas Bogotá',
      destination: 'Bogotá, Colombia',
      startDate:   new Date('2026-08-05'),
      endDate:     new Date('2026-08-07'),
      status:      'PENDING',
      description: 'Presentación de nuevos productos al equipo de Bogotá.',
      budget:      1800,
      managerId:   admin.id,
    },
  })

  console.log('✅ Viajes creados')

  // ─── GASTOS ───────────────────────────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      {
        title:       'Vuelo Lima ida y vuelta',
        amount:      650,
        category:    'TRANSPORT',
        date:        new Date('2026-07-14'),
        description: 'Tiquete aéreo clase económica',
        tripId:      trip1.id,
        createdById: manager.id,
      },
      {
        title:       'Hotel 3 noches',
        amount:      480,
        category:    'ACCOMMODATION',
        date:        new Date('2026-07-15'),
        description: 'Hotel Business Lima, habitación estándar',
        tripId:      trip1.id,
        createdById: manager.id,
      },
      {
        title:       'Alimentación conferencia',
        amount:      120,
        category:    'FOOD',
        date:        new Date('2026-07-15'),
        description: 'Viáticos de alimentación durante los 3 días',
        tripId:      trip1.id,
        createdById: manager.id,
      },
      {
        title:       'Vuelo Bogotá',
        amount:      420,
        category:    'TRANSPORT',
        date:        new Date('2026-08-04'),
        tripId:      trip2.id,
        createdById: admin.id,
      },
    ],
  })

  console.log('✅ Gastos creados')

  // ─── ACTIVIDADES ──────────────────────────────────────────────────────────────
  await prisma.activity.createMany({
    data: [
      {
        title:       'Registro y acreditación',
        description: 'Check-in en el hotel y registro en la conferencia',
        date:        new Date('2026-07-15T09:00:00'),
        location:    'Centro de Convenciones Lima',
        duration:    60,
        tripId:      trip1.id,
      },
      {
        title:       'Keynote: El futuro del software empresarial',
        description: 'Ponencia principal del evento sobre tendencias tech',
        date:        new Date('2026-07-15T10:00:00'),
        location:    'Auditorio Principal',
        duration:    90,
        tripId:      trip1.id,
      },
      {
        title:       'Workshop: APIs REST con Node.js',
        description: 'Taller práctico de desarrollo de APIs modernas',
        date:        new Date('2026-07-16T14:00:00'),
        location:    'Sala B — Piso 2',
        duration:    180,
        tripId:      trip1.id,
      },
      {
        title:       'Presentación de portafolio',
        description: 'Demostración de los nuevos productos al equipo Bogotá',
        date:        new Date('2026-08-05T10:00:00'),
        location:    'Oficina cliente — Bogotá',
        duration:    120,
        tripId:      trip2.id,
      },
    ],
  })

  console.log('✅ Actividades creadas')
  console.log('\n🎉 Seed completado exitosamente')
  console.log('\n📧 Credenciales de demo:')
  console.log('   ADMIN    → admin@empresa.com    / Admin1234!')
  console.log('   MANAGER  → manager@empresa.com  / Manager1234!')
  console.log('   EMPLOYEE → empleado@empresa.com / Empleado1234!')
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
