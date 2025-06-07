// theme-editor.js
const root = document.documentElement;

function applyTheme() {
  root.style.setProperty('--font-size', document.getElementById('fontSize').value + 'px');
  root.style.setProperty('--border-radius', document.getElementById('borderRadius').value + 'px');
  root.style.setProperty('--shadow-opacity', document.getElementById('shadow').value);
  root.style.setProperty('--font-family', document.getElementById('fontFamily').value);
  root.style.setProperty('--container-bg', document.getElementById('containerBg').value);
  root.style.setProperty('--font-color', document.getElementById('fontColor').value);
  root.style.setProperty('--button-bg', document.getElementById('buttonBg').value);
  root.style.setProperty('--button-text', document.getElementById('buttonText').value);
  document.body.style.backgroundColor = document.getElementById('bgColor').value;
}

function handleExport() {
  const name = document.getElementById('themeNameExport').value || 'custom-theme';
  const filename = 'theme-' + name.toLowerCase().replace(/\s+/g, '-') + '.css';
  const css = `:root {
  --font-size: ${document.getElementById('fontSize').value}px;
  --border-radius: ${document.getElementById('borderRadius').value}px;
  --shadow-opacity: ${document.getElementById('shadow').value};
  --font-family: ${document.getElementById('fontFamily').value};
  --container-bg: ${document.getElementById('containerBg').value};
  --font-color: ${document.getElementById('fontColor').value};
  --button-bg: ${document.getElementById('buttonBg').value};
  --button-text: ${document.getElementById('buttonText').value};
}
body {
  background: ${document.getElementById('bgColor').value};
}`;
  document.querySelector('.export-output').value = css;

  const blob = new Blob([css], { type: 'text/css' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();

  document.getElementById('linkPreview').innerText = `<link rel="stylesheet" href="/themes/${filename}">`;
}

function handleSave() {
  const name = document.getElementById('themeNameExport').value.trim();
  if (!name) return alert("Please enter a theme name before saving.");
  const key = 'rquestify-theme-' + name.toLowerCase().replace(/\s+/g, '-');
  const css = document.querySelector('.export-output').value;
  localStorage.setItem(key, css);
  populateThemeDropdown();
  alert(`Theme "${name}" saved!`);
}

function populateThemeDropdown() {
  const dropdown = document.getElementById('themeSelect');
  dropdown.innerHTML = '<option value="">-- Select Theme --</option>';
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('rquestify-theme-')) {
      const option = document.createElement('option');
      option.value = k;
      option.textContent = k.replace('rquestify-theme-', '');
      dropdown.appendChild(option);
    }
  });
}

function loadSelectedTheme() {
  const key = document.getElementById('themeSelect').value;
  if (!key) return alert("Please select a theme to load.");
  const css = localStorage.getItem(key);
  if (!css) return alert("No theme found.");
  applyCSSFromString(css);
}

function deleteSelectedTheme() {
  const key = document.getElementById('themeSelect').value;
  if (!key) return alert("Please select a theme to delete.");
  if (confirm("Delete this theme?")) {
    localStorage.removeItem(key);
    populateThemeDropdown();
  }
}

function applyCSSFromString(css) {
  const vars = {
    '--font-size': /--font-size:\s*([\d.]+)px/.exec(css),
    '--border-radius': /--border-radius:\s*([\d.]+)px/.exec(css),
    '--shadow-opacity': /--shadow-opacity:\s*([\d.]+)/.exec(css),
    '--font-family': /--font-family:\s*([^;]+)/.exec(css),
    '--container-bg': /--container-bg:\s*(#[0-9a-fA-F]{3,6})/.exec(css),
    '--font-color': /--font-color:\s*(#[0-9a-fA-F]{3,6})/.exec(css),
    '--button-bg': /--button-bg:\s*(#[0-9a-fA-F]{3,6})/.exec(css),
    '--button-text': /--button-text:\s*(#[0-9a-fA-F]{3,6})/.exec(css),
    '--bg': /background:\s*(#[0-9a-fA-F]{3,6})/.exec(css)
  };

  for (const key in vars) {
    if (vars[key]) {
      const value = vars[key][1];
      switch (key) {
        case '--bg':
          document.body.style.backgroundColor = value;
          break;
        default:
          root.style.setProperty(key, value);
          break;
      }
    }
  }

  document.getElementById('fontSize').value = parseInt(vars['--font-size']?.[1] || 16);
  document.getElementById('borderRadius').value = parseInt(vars['--border-radius']?.[1] || 8);
  document.getElementById('shadow').value = parseFloat(vars['--shadow-opacity']?.[1] || 0.1);
  document.getElementById('fontFamily').value = vars['--font-family']?.[1]?.trim() || "'Segoe UI', sans-serif";
  document.getElementById('containerBg').value = vars['--container-bg']?.[1] || '#0b0538';
  document.getElementById('fontColor').value = vars['--font-color']?.[1] || '#ffffff';
  document.getElementById('buttonBg').value = vars['--button-bg']?.[1] || '#ffc107';
  document.getElementById('buttonText').value = vars['--button-text']?.[1] || '#000000';
  document.getElementById('bgColor').value = vars['--bg']?.[1] || '#2e2669';

  applyTheme();
}

document.querySelectorAll('.controls input, .controls select').forEach(el => {
  el.addEventListener('input', applyTheme);
});

document.addEventListener('DOMContentLoaded', () => {
  populateThemeDropdown();
  if (localStorage.getItem('rquestify-theme')) {
    document.getElementById('themeSelect').value = 'rquestify-theme';
    loadSelectedTheme();
  } else {
    applyTheme();
  }
});
