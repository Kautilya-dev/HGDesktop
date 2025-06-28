const fs = require('fs');
const path = require('path');

window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const resumeFile = urlParams.get('file');
  if (!resumeFile) return;

  const resumePath = path.resolve(__dirname, '..', 'data', resumeFile);
  const form = document.getElementById('resumeForm');
  form.dataset.sourceFile = resumeFile; // ✅ Store file name for saving

  fs.readFile(resumePath, 'utf-8', (err, data) => {
    if (err) {
      console.info('Failed to load résumé:', err.message);
      return;
    }

    try {
      const resume = JSON.parse(data);

      document.getElementById('displayName').value = resume.displayName || '';
      document.querySelector('[name=name]').value = resume.name || '';
      document.querySelector('[name=email]').value = resume.email || '';
      document.querySelector('[name=phone]').value = resume.phone || '';
      document.querySelector('[name=skills]').value = resume.skills || '';

      resume.education?.forEach((edu, i) => {
        addEducation();
        document.querySelector(`[name=edu_degree_${i}]`).value = edu.degree;
        document.querySelector(`[name=edu_institution_${i}]`).value = edu.institution;
        document.querySelector(`[name=edu_year_${i}]`).value = edu.year;
      });

      resume.experience?.forEach((exp, i) => {
        addExperience();
        document.querySelector(`[name=exp_title_${i}]`).value = exp.title;
        document.querySelector(`[name=exp_company_${i}]`).value = exp.company;
        document.querySelector(`[name=exp_years_${i}]`).value = exp.years;
      });

      resume.notes?.forEach((note, i) => {
        addNote();
        document.querySelector(`[name=note_title_${i}]`).value = note.title;
        document.querySelector(`[name=note_text_${i}]`).value = note.text;
      });
    } catch (e) {
      console.info('Error parsing résumé JSON:', e.message);
    }
  });
});
