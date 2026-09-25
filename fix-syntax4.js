const fs = require('fs');
let server = fs.readFileSync('f:/STUDY/Eng Proj/server.js', 'utf8');
const lines = server.split('\n');
let start = -1;
let end = -1;
for(let i = 880; i < 910; i++) {
  if (lines[i] && lines[i].includes('const prompt = ') && lines[i].includes('Decipher')) {
    start = i;
  }
  if (start > -1 && lines[i] && lines[i].includes('[ACTION:none]')) {
    end = i + 3; 
    break;
  }
}

if (start > -1 && end > -1) {
  const b64 = 'ICBjb25zdCBwcm9tcHQgPSBgWW91IGFyZSB0aGUgaW50ZW50IGVuZ2luZSBmb3IgIkRlY2lwaGVyIiwgYW4gQUkgdm9jYWJ1bGFyeSBhcHAuClRoZSB1c2VyIHNwb2tlIGEgdm9pY2UgY29tbWFuZC4gSWRlbnRpZnkgdGhlaXIgaW50ZW5kZWQgYWN0aW9uLgpMYW5ndWFnZSAoQkNQLTQ3KTogJHtsYW5nIHx8ICd1bmtub3duJ30KVHJhbnNjcmlwdDogIiR7dXR0ZXJhbmNlfSIKClJlcGx5IHdpdGggRVhBQ1RMWSBvbmUgdGFnOgpbQUNUSU9OOm5hdlN0dWRpb10gW0FDVElPTjpuYXZRdWl6XSBbQUNUSU9OOm5hdkxpYnJhcnldIFtBQ1RJT046bmF2SG9tZV0KW0FDVElPTjpuYXZBYm91dF0gW0FDVElPTjphbmFseXplXSBbQUNUSU9OOnRyYW5zbGF0ZV0gW0FDVElPTjptZW1vcnlIb29rc10KW0FDVElPTjpzdG9yeV0gW0FDVElPTjpzaW1wbGlmeV0gW0FDVElPTjpvcHBvc2l0ZURheV0gW0FDVElPTjpzYXZlXQpbQUNUSU9OOnN0YXJ0UXVpel0gW0FDVElPTjpsb2FkU2FtcGxlXSBbQUNUSU9uOm5vbmVdCgpSZXBseSB3aXRoIG9ubHkgdGhlIHRhZy5gOw==';
  const newBlock = Buffer.from(b64, 'base64').toString('utf8');
  const before = lines.slice(0, start);
  const after = lines.slice(end + 1);
  const newLines = [...before, newBlock, ...after];
  fs.writeFileSync('f:/STUDY/Eng Proj/server.js', newLines.join('\n'), 'utf8');
  console.log('Fixed syntax error!');
} else {
  console.log('Could not find start/end lines');
}