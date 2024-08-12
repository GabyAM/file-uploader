const units = [
  {name: 'byte', bytes: 1},
  {name: 'KB', bytes: 1024},
  {name: 'MB', bytes: 1024 * 1024},
];
function formatSize(bytes) {
  for (let i = units.length - 1; i >= 0; i--) {
    const conversed = Math.floor((bytes / units[i].bytes) * 10) / 10;
    if (conversed >= 1) {
      let formatted = conversed + ' ' + units[i].name;
      if (i === 0) formatted += 's';
      return formatted;
    }
  }
  return '0 bytes';
}

module.exports = formatSize;
