function parseInf(line) {
  const infContent = line.substring(8);
  // Match comma that is not inside quotes
  // A simple way is to match the last quote, and find the first comma after it.
  // Or match: `,(?=(?:[^"]*"[^"]*")*[^"]*$)` - but attributes can have single quotes too.
  
  let inDoubleQuotes = false;
  let inSingleQuotes = false;
  let commaIdx = -1;
  
  for(let i=0; i<infContent.length; i++) {
    const char = infContent[i];
    if (char === '"' && !inSingleQuotes) inDoubleQuotes = !inDoubleQuotes;
    else if (char === "'" && !inDoubleQuotes) inSingleQuotes = !inSingleQuotes;
    else if (char === ',' && !inDoubleQuotes && !inSingleQuotes) {
      commaIdx = i;
      break; // found the first unquoted comma
    }
  }
  
  if (commaIdx !== -1) {
    return infContent.substring(commaIdx + 1).trim();
  }
  return "";
}

console.log(parseInf('#EXTINF:-1 group-title="News, Live",Channel 1, HD'));
console.log(parseInf('#EXTINF:-1 group-title=\'News, Live\',Channel 2'));
console.log(parseInf('#EXTINF:-1,Channel 3'));
