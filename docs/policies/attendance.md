# Attendance policy (MVP defaults)

- Check-in allowed within **150 m** of assigned office location.
- Standard shift: **9:30 AM – 6:30 PM** (configurable per location/shift).
- Grace period: **15 minutes**. Check-in after grace → `late`.
- Worked hours < 4 → `half_day`.
- No approved check-in by daily close (11:00 AM next day) → `absent`.
- Location outside radius creates an **exception** (not auto-rejection) for manager review.
- Flag: mock-location, GPS accuracy > 100 m, duplicate device, impossible travel.
- Prior workday locked at 11:00 AM; corrections require reason + approver (audit logged).
- Foreground location consent only at check-in/out. No continuous background tracking in MVP.
