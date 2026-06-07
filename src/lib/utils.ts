export function formatName(name: string): string {
  if (!name) return '';
  const lowercaseWords = ['da', 'de', 'do', 'das', 'dos', 'e'];
  return name
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map((word, index) => {
      if (index !== 0 && lowercaseWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function calculateLifespan(birthDate: string, deathDate: string): string {
  if (!birthDate || !deathDate) return '';
  
  const birth = new Date(birthDate);
  const death = new Date(deathDate);
  
  if (isNaN(birth.getTime()) || isNaN(death.getTime())) return '';

  let years = death.getFullYear() - birth.getFullYear();
  let months = death.getMonth() - birth.getMonth();

  if (months < 0 || (months === 0 && death.getDate() < birth.getDate())) {
    years--;
    months += 12;
  }
  
  if (death.getDate() < birth.getDate()) {
    months--;
  }
  
  if (months < 0) {
     months = 11;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} ano${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);

  return parts.join(' e ') || 'Menos de 1 mês';
}
