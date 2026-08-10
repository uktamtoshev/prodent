import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listClinicDoctorOptions } from './clinic-doctor-options';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('clinic service doctor candidates API', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('prodent_access_token', 'access-token');
    vi.restoreAllMocks();
  });

  it('loads eligible candidates from the clinic-scoped endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([{
      doctorId: 'doctor-1',
      specialty: 'Dentist',
      fullName: 'Doctor One',
      avatarUrl: null,
    }]));

    await expect(listClinicDoctorOptions('clinic-1')).resolves.toEqual([{
      doctor_id: 'doctor-1',
      doctors: {
        id: 'doctor-1',
        specialty: 'Dentist',
        profiles: { full_name: 'Doctor One', avatar_url: null },
      },
    }]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/clinics/clinic-1/service-doctor-candidates',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects malformed candidates before they reach the UI', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([{
      doctorId: 'doctor-1',
      specialty: null,
      fullName: 10,
      avatarUrl: null,
    }]));

    await expect(listClinicDoctorOptions('clinic-1')).rejects.toMatchObject({ status: 502 });
  });
});
