// Common resume section headings, grouped under one key each.
const SECTION_HEADINGS = {
  contact: ['contact', 'contact information', 'contact info', 'contact details', 'personal details', 'personal information'],
  summary: ['summary', 'professional summary', 'profile', 'professional profile', 'objective', 'career objective', 'about', 'about me'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'internship', 'internships', 'relevant experience'],
  education: ['education', 'academic background', 'academics', 'qualifications', 'education & training'],
  skills: ['skills', 'technical skills', 'core skills', 'key skills', 'skills & tools', 'skills and tools', 'technologies', 'tech stack', 'tools', 'competencies', 'core competencies', 'skills & abilities'],
  projects: ['projects', 'personal projects', 'academic projects', 'key projects', 'selected projects'],
  certifications: ['certifications', 'certificates', 'licenses', 'licenses & certifications', 'courses', 'training'],
  achievements: ['achievements', 'awards', 'honors', 'honours', 'accomplishments', 'awards & achievements'],
  other: ['languages', 'interests', 'hobbies', 'publications', 'volunteering', 'volunteer experience', 'activities', 'extracurricular activities', 'leadership', 'references'],
};

export const SECTION_LABELS = {
  header: 'Header',
  contact: 'Contact',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  achievements: 'Achievements',
  other: 'Other',
};

export function findSectionKey(text) {
  const heading = String(text)
    .toLowerCase()
    .replace(/[^a-z& ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [key, names] of Object.entries(SECTION_HEADINGS)) {
    if (names.includes(heading)) return key;
  }
  return null;
}
