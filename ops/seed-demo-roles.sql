-- Reassign demo users to their proper roles after they were registered via
-- /api/v1/auth/register (which auto-assigns PATIENT).
-- Single password for all 9: Demo2026Pass!

DELETE FROM user_roles WHERE user_id IN (
  SELECT id FROM users WHERE email IN (
    'superadmin@prodent.uz','adm@prodent.uz','mod@prodent.uz',
    'clinicadm@prodent.uz','manager@prodent.uz','doc@prodent.uz',
    'assist@prodent.uz','acc@prodent.uz','pat@prodent.uz'
  )
);

INSERT INTO user_roles (user_id, role) VALUES
  ((SELECT id FROM users WHERE email='superadmin@prodent.uz'), 'SUPER_ADMIN'),
  ((SELECT id FROM users WHERE email='adm@prodent.uz'),         'ADMIN'),
  ((SELECT id FROM users WHERE email='mod@prodent.uz'),         'MODERATOR'),
  ((SELECT id FROM users WHERE email='clinicadm@prodent.uz'),   'CLINIC_ADMIN'),
  ((SELECT id FROM users WHERE email='manager@prodent.uz'),     'CLINIC_MANAGER'),
  ((SELECT id FROM users WHERE email='doc@prodent.uz'),         'DOCTOR'),
  ((SELECT id FROM users WHERE email='assist@prodent.uz'),      'ASSISTANT'),
  ((SELECT id FROM users WHERE email='acc@prodent.uz'),         'ACCOUNTANT'),
  ((SELECT id FROM users WHERE email='pat@prodent.uz'),         'PATIENT')
ON CONFLICT DO NOTHING;
