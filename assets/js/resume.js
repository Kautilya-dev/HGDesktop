// ✅ resume.js
(() => {
  const { ipcRenderer } = require('electron');
  let eduCount = 0, expCount = 0, noteCount = 0;

  window.addEducation = () => {
    const list = document.getElementById('educationList');
    const index = eduCount++;
    const div = document.createElement('div');
    div.className = 'row g-2 align-items-center mb-2';
    div.innerHTML = `
      <div class="col-md-4"><input id="edu-degree-${index}" name="edu_degree_${index}" class="form-control" placeholder="e.g. B.Tech in CS" required></div>
      <div class="col-md-4"><input id="edu-institution-${index}" name="edu_institution_${index}" class="form-control" placeholder="e.g. IIT Hyderabad" required></div>
      <div class="col-md-3"><input id="edu-year-${index}" name="edu_year_${index}" class="form-control" placeholder="e.g. 2023" pattern="\\d{4}" required></div>
      <div class="col-md-1 text-end"><button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">✖</button></div>`;
    list.appendChild(div);
  };

  window.addExperience = () => {
    const list = document.getElementById('experienceList');
    const index = expCount++;
    const div = document.createElement('div');
    div.className = 'row g-2 align-items-center mb-2';
    div.innerHTML = `
      <div class="col-md-4"><input id="exp-title-${index}" name="exp_title_${index}" class="form-control" placeholder="e.g. Software Engineer" required></div>
      <div class="col-md-4"><input id="exp-company-${index}" name="exp_company_${index}" class="form-control" placeholder="e.g. Infosys" required></div>
      <div class="col-md-3"><input id="exp-years-${index}" name="exp_years_${index}" class="form-control" placeholder="e.g. 2 years" required></div>
      <div class="col-md-1 text-end"><button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">✖</button></div>`;
    list.appendChild(div);
  };

  window.addNote = () => {
    const list = document.getElementById('notesList');
    const index = noteCount++;
    const div = document.createElement('div');
    div.className = 'mb-3 border rounded p-3 position-relative';
    div.innerHTML = `
      <button type="button" class="btn-close position-absolute top-0 end-0 m-2" onclick="this.parentElement.remove()"></button>
      <label class="form-label fw-semibold">Scenario Title</label>
      <input id="note-title-${index}" class="form-control mb-2" name="note_title_${index}" placeholder="e.g. Handling Downtime" required>
      <label class="form-label fw-semibold">Scenario Detail</label>
      <textarea id="note-text-${index}" class="form-control" name="note_text_${index}" rows="4" placeholder="Describe the scenario in detail…" required></textarea>`;
    list.appendChild(div);
  };

  document.addEventListener('DOMContentLoaded', () => {
    addEducation(); addExperience(); addNote();
    const form = document.getElementById('resumeForm');
    const saveBtn = document.getElementById('saveBtn');
    const alertBox = document.getElementById('saveAlert');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        displayName: fd.get('displayName'),
        name: fd.get('name'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        skills: fd.get('skills'),
        education: [],
        experience: [],
        notes: [],
        _sourceFile: form.dataset.sourceFile || null // ✅ very important
      };

      for (let i = 0; i < eduCount; i++) {
        const deg = fd.get(`edu_degree_${i}`);
        const inst = fd.get(`edu_institution_${i}`);
        const yr = fd.get(`edu_year_${i}`);
        if (deg && inst && yr) data.education.push({ degree: deg, institution: inst, year: yr });
      }
      for (let i = 0; i < expCount; i++) {
        const title = fd.get(`exp_title_${i}`);
        const comp = fd.get(`exp_company_${i}`);
        const yrs = fd.get(`exp_years_${i}`);
        if (title && comp && yrs) data.experience.push({ title, company: comp, years: yrs });
      }
      for (let i = 0; i < noteCount; i++) {
        const title = fd.get(`note_title_${i}`);
        const text = fd.get(`note_text_${i}`);
        if (title && text) data.notes.push({ title, text });
      }
      saveBtn.disabled = true; saveBtn.innerText = 'Saving…';
      ipcRenderer.send('save-resume', data);
    });

    ipcRenderer.on('resume-saved', (_, fp) => {
      showAlert('success', 'Resume saved ✔');
      resetForm();
    });

    ipcRenderer.on('resume-save-error', (_, err) => {
      showAlert('danger', `Save failed – ${err}`);
      saveBtn.disabled = false; saveBtn.innerText = '💾 Save Resume';
    });

    function showAlert(type, msg) {
      alertBox.className = `alert alert-${type}`;
      alertBox.textContent = msg;
      alertBox.classList.remove('d-none');
      setTimeout(() => alertBox.classList.add('d-none'), 4000);
    }

    function resetForm() {
      form.reset();
      document.getElementById('educationList').innerHTML = '';
      document.getElementById('experienceList').innerHTML = '';
      document.getElementById('notesList').innerHTML = '';
      eduCount = expCount = noteCount = 0;
      addEducation(); addExperience(); addNote();
      saveBtn.disabled = false; saveBtn.innerText = '💾 Save Resume';
    }
  });
})();
