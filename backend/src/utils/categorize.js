const RULES = [
  { category: 'Billeder', test: (mime, ext) => mime.startsWith('image/') },
  { category: 'Video', test: (mime, ext) => mime.startsWith('video/') },
  { category: 'Audio', test: (mime, ext) => mime.startsWith('audio/') },
  { category: 'PDF', test: (mime, ext) => mime === 'application/pdf' },
  {
    category: 'Office',
    test: (mime, ext) =>
      /officedocument|msword|ms-excel|ms-powerpoint|opendocument/.test(mime) ||
      ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext),
  },
  {
    category: 'ZIP',
    test: (mime, ext) => /zip|x-7z|x-rar|x-tar|gzip/.test(mime) || ['zip', '7z', 'rar', 'tar', 'gz'].includes(ext),
  },
  {
    category: 'CAD',
    test: (mime, ext) => ['dwg', 'dxf', 'step', 'stp', 'iges', 'igs'].includes(ext),
  },
  {
    category: '3D',
    test: (mime, ext) => ['obj', 'fbx', 'stl', 'gltf', 'glb', 'blend', '3ds'].includes(ext),
  },
  {
    category: 'Dokumenter',
    test: (mime, ext) => mime.startsWith('text/') || ext === 'txt' || ext === 'csv' || ext === 'json',
  },
];

function categorize(mime, originalName) {
  const ext = (originalName.split('.').pop() || '').toLowerCase();
  for (const rule of RULES) {
    if (rule.test(mime || '', ext)) return rule.category;
  }
  return 'Andet';
}

const ALL_CATEGORIES = ['Billeder', 'Video', 'Audio', 'Dokumenter', 'Office', 'PDF', 'ZIP', 'CAD', '3D', 'Andet'];

module.exports = { categorize, ALL_CATEGORIES };
