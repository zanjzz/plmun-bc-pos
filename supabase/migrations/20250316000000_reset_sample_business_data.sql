-- Replace operational demo data while preserving authentication users and profiles.
delete from public.notifications;
delete from public.transaction_items;
delete from public.transactions;
delete from public.inventory_movements;
delete from public.order_status_history;
delete from public.order_items;
delete from public.orders;
delete from public.products;

insert into public.products (id, name, category, description, image, price, stock)
values
  (
    1,
    'School Uniform Set',
    'Uniforms',
    'Official PLMun blouse or polo and matching pants or skirt for regular school days.',
    '/assets/stationery.jpg',
    850,
    35
  ),
  (
    2,
    'PE Uniform Set',
    'PE & Athletics',
    'Official PE shirt and jogging pants designed for classes and campus activities.',
    '/assets/stationery.jpg',
    650,
    28
  ),
  (
    3,
    'University ID Lace',
    'Identification',
    'Official PLMun woven ID lace with a durable metal clip.',
    '/assets/notebook-pen.jpg',
    80,
    90
  ),
  (
    4,
    'ID Card Holder',
    'Identification',
    'Clear protective holder sized for the university identification card.',
    '/assets/stationery.jpg',
    35,
    75
  ),
  (
    5,
    'Scantron Answer Sheet',
    'Assessment Supplies',
    'Standard machine-readable answer sheet for university examinations.',
    '/assets/stationery.jpg',
    15,
    200
  ),
  (
    6,
    'Examination Booklet',
    'Assessment Supplies',
    'Ruled examination booklet for written tests and essay responses.',
    '/assets/spiral-notebook.jpg',
    12,
    180
  ),
  (
    7,
    'Spiral Notebook',
    'School Supplies',
    'A5 ruled notebook with 80 smooth, easy-tear pages.',
    '/assets/spiral-notebook.jpg',
    45,
    60
  ),
  (
    8,
    'Black Ballpen',
    'School Supplies',
    'Reliable 0.5 mm black ink ballpen for classwork and examinations.',
    '/assets/notebook-pen.jpg',
    20,
    120
  ),
  (
    9,
    'Black & White Printing · per page',
    'Services',
    'Clear black and white printing on standard A4 paper.',
    '/assets/stationery.jpg',
    3,
    999
  ),
  (
    10,
    'Color Printing · per page',
    'Services',
    'Full-color printing on standard A4 paper for school requirements.',
    '/assets/stationery.jpg',
    10,
    999
  ),
  (
    11,
    'Photocopying · per page',
    'Services',
    'Fast, clear A4 photocopying for documents and class materials.',
    '/assets/notebook-pen.jpg',
    2,
    999
  ),
  (
    12,
    'ID-size Lamination',
    'Services',
    'Protective hot lamination for identification cards and small documents.',
    '/assets/notebook-pen.jpg',
    25,
    999
  );

select setval(pg_get_serial_sequence('public.products', 'id'), 12, true);
