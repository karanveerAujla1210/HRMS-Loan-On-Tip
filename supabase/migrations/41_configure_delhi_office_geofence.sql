-- Configure the Delhi Head Office attendance geofence supplied by the customer.
update public.locations
set latitude = 28.64227746874082,
    longitude = 77.14478229513094,
    attendance_radius_meters = 70,
    updated_at = now()
where location_code = 'DEL-HO';