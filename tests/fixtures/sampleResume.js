// A one-page resume and a matching job post, shared by tests and the demo PDF script.

export const SAMPLE_RESUME_LINES = [
  { x: 72, y: 740, size: 20, bold: true, text: 'Asha Verma' },
  { x: 72, y: 720, size: 10, text: 'asha.verma@example.com | +91 98765 43210 | Pune, India' },
  { x: 72, y: 690, size: 12, bold: true, text: 'SUMMARY' },
  { x: 72, y: 672, text: 'Frontend developer with 3 years of experience building web apps in React and JavaScript.' },
  { x: 72, y: 645, size: 12, bold: true, text: 'SKILLS' },
  { x: 72, y: 627, text: 'JavaScript, React, HTML, CSS, Node.js, Git, Figma' },
  { x: 72, y: 600, size: 12, bold: true, text: 'EXPERIENCE' },
  { x: 72, y: 582, bold: true, text: 'Software Engineer, Brightpath Labs' },
  { x: 460, y: 582, text: 'Jan 2022 - Present' },
  { x: 72, y: 564, text: '• Responsible for building reusable UI components for the customer dashboard' },
  { x: 72, y: 548, text: '• Worked on the checkout page and improved load time by 40%' },
  { x: 72, y: 532, text: '• Collaborated with designers in Figma to ship new onboarding screens for' },
  { x: 82, y: 518, text: 'mobile and desktop users' },
  { x: 72, y: 502, text: '• Helped migrate the frontend build from Webpack to Vite' },
  { x: 72, y: 474, size: 12, bold: true, text: 'PROJECTS' },
  { x: 72, y: 456, text: 'Recipe Finder - a React app that suggests meals from what is in your fridge' },
  { x: 72, y: 428, size: 12, bold: true, text: 'EDUCATION' },
  { x: 72, y: 410, text: 'B.Tech in Computer Science, Pune University, 2021' },
];

export const SAMPLE_JOB_DESCRIPTION = `Frontend Engineer (React)
We are looking for a Frontend Engineer to build fast, accessible web apps for our customers.
Requirements:
- 2+ years building web apps with React and TypeScript
- Strong JavaScript, HTML and CSS
- Experience with REST APIs and GraphQL
- Unit testing with Jest
- Familiar with CI/CD and Docker
- Good communication and teamwork
Nice to have: Next.js, Tailwind CSS, accessibility (WCAG), dashboard performance work.`;
