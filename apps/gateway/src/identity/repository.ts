import type { DatabasePoolLike } from "../db/client.js";

export async function listOrganizations(pool: DatabasePoolLike, organizationId: string) {
  const result = await pool.query<{
    id: string;
    name: string;
    legal_name: string | null;
    timezone: string;
    active: boolean;
  }>(
    `
      SELECT id, name, legal_name, timezone, active
      FROM dentos_data.organizations
      WHERE id = $1
    `,
    [organizationId],
  );
  return result.rows;
}

export async function listClinics(pool: DatabasePoolLike, organizationId: string) {
  const result = await pool.query<{
    id: string;
    clinic_code: string;
    name: string;
    timezone: string;
    active: boolean;
  }>(
    `
      SELECT id, clinic_code, name, timezone, active
      FROM dentos_data.clinics
      WHERE organization_id = $1
      ORDER BY clinic_code ASC
    `,
    [organizationId],
  );
  return result.rows;
}

export async function listStaff(pool: DatabasePoolLike, organizationId: string) {
  const result = await pool.query<{
    id: string;
    display_name: string;
    staff_type: string | null;
    active: boolean | null;
  }>(
    `
      SELECT id, display_name, staff_type, active
      FROM dentos_data.staff
      WHERE organization_id = $1
      ORDER BY display_name ASC
    `,
    [organizationId],
  );
  return result.rows;
}

export async function createStaff(
  pool: DatabasePoolLike,
  input: {
    organizationId: string;
    displayName: string;
    staffType: string;
    clinicId: string;
    createdBy?: string;
  },
) {
  const staffId = crypto.randomUUID();
  await pool.query(
    `
      INSERT INTO dentos_data.staff (
        id, organization_id, display_name, staff_type, active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, true, $5, $5)
    `,
    [staffId, input.organizationId, input.displayName, input.staffType, input.createdBy ?? null],
  );
  await pool.query(
    `
      INSERT INTO dentos_data.staff_clinics (staff_id, clinic_id, active, created_by, updated_by)
      VALUES ($1, $2, true, $3, $3)
    `,
    [staffId, input.clinicId, input.createdBy ?? null],
  );
  return { id: staffId };
}

export async function listUsers(pool: DatabasePoolLike, organizationId: string) {
  const result = await pool.query<{
    id: string;
    login_name: string;
    display_name: string;
    status: string;
  }>(
    `
      SELECT id, login_name, display_name, status
      FROM dentos_data.users
      WHERE organization_id = $1
      ORDER BY login_name ASC
    `,
    [organizationId],
  );
  return result.rows;
}

export async function linkStaffToUser(
  pool: DatabasePoolLike,
  input: { organizationId: string; staffId: string; userId: string; linkedBy: string },
) {
  await pool.query(
    `
      INSERT INTO dentos_data.staff_user_links (
        id, organization_id, staff_id, user_id, linked_by, linked_at, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, clock_timestamp(), $5, $5)
    `,
    [crypto.randomUUID(), input.organizationId, input.staffId, input.userId, input.linkedBy],
  );
}
