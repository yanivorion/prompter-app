import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [parseMode, setParseMode] = useState(false);
  const [rawPrompt, setRawPrompt] = useState('');
  const [activeTab, setActiveTab] = useState('edit');
  const [editingSubject, setEditingSubject] = useState(null);
  const contentRefs = useRef({});

  // Configuration
  const config = {
    backgroundColor: '#FFFFFF',
    sidebarBackgroundColor: '#F8F9FA',
    headerTextColor: '#212529',
    contentBackgroundColor: '#FFFFFF',
    contentTextColor: '#495057',
    borderColor: '#E9ECEF',
    accentColor: '#495057',
    activeBackgroundColor: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    lineHeight: '1.6',
    showSearch: true,
    showActions: true
  };

  const backgroundColor = config.backgroundColor;
  const sidebarBg = config.sidebarBackgroundColor;
  const headerText = config.headerTextColor;
  const contentBg = config.contentBackgroundColor;
  const contentText = config.contentTextColor;
  const borderColor = config.borderColor;
  const accentColor = config.accentColor;
  const activeBg = config.activeBackgroundColor;
  const fontSize = config.fontSize;
  const fontFamily = config.fontFamily;
  const lineHeight = config.lineHeight;
  const showSearch = config.showSearch;
  const showActions = config.showActions;

  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  const parsePrompt = (text) => {
    const lines = text.split('\n');
    const parsed = [];
    let currentH1 = null;
    let currentH2 = null;
    let currentH3 = null;
    let buffer = [];
    let inCodeBlock = false;
    let inXmlBlock = false;
    let xmlBlockName = '';

    const createSection = (level, title, content = '') => ({
      id: Date.now() + Math.random(),
      level,
      title: title.trim(),
      content: content.trim(),
      visible: true,
      subjects: []
    });

    const saveBuffer = () => {
      const content = buffer.join('\n').trim();
      if (currentH3) {
        currentH3.content = content;
      } else if (currentH2) {
        currentH2.content = content;
      } else if (currentH1) {
        currentH1.content = content;
      }
      buffer = [];
    };

    lines.forEach((line) => {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        buffer.push(line);
        return;
      }

      if (inCodeBlock) {
        buffer.push(line);
        return;
      }

      const xmlOpenMatch = line.match(/^<([a-zA-Z_][a-zA-Z0-9_]*)>$/);
      if (xmlOpenMatch && !inXmlBlock) {
        saveBuffer();
        inXmlBlock = true;
        xmlBlockName = xmlOpenMatch[1];
        currentH2 = createSection(2, xmlBlockName);
        if (currentH1) {
          currentH1.subjects.push(currentH2);
        } else {
          parsed.push(currentH2);
        }
        currentH3 = null;
        return;
      }

      const xmlCloseMatch = line.match(/^<\/([a-zA-Z_][a-zA-Z0-9_]*)>$/);
      if (xmlCloseMatch && inXmlBlock && xmlCloseMatch[1] === xmlBlockName) {
        saveBuffer();
        inXmlBlock = false;
        xmlBlockName = '';
        return;
      }

      if (inXmlBlock) {
        buffer.push(line);
        return;
      }

      if (line.match(/^#\s+[^#]/)) {
        saveBuffer();
        const title = line.replace(/^#\s+/, '');
        currentH1 = createSection(1, title);
        parsed.push(currentH1);
        currentH2 = null;
        currentH3 = null;
      } else if (line.match(/^##\s+[^#]/)) {
        saveBuffer();
        const title = line.replace(/^##\s+/, '');
        currentH2 = createSection(2, title);
        if (currentH1) {
          currentH1.subjects.push(currentH2);
        } else {
          parsed.push(currentH2);
        }
        currentH3 = null;
      } else if (line.match(/^###\s+[^#]/)) {
        saveBuffer();
        const title = line.replace(/^###\s+/, '');
        currentH3 = createSection(3, title);
        if (currentH2) {
          currentH2.subjects.push(currentH3);
        } else if (currentH1) {
          currentH1.subjects.push(currentH3);
        } else {
          parsed.push(currentH3);
        }
      } else {
        buffer.push(line);
      }
    });

    saveBuffer();
    return parsed;
  };

  const handleParse = () => {
    const parsed = parsePrompt(rawPrompt);
    setSections(parsed);
    if (parsed.length > 0) {
      setSelectedSection(parsed[0]);
    }
    setParseMode(true);
  };

  const toggleSubject = (id) => {
    setExpandedSubjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const isSubjectExpanded = (id) => expandedSubjects.has(id);

  const filterContent = (text) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const highlightText = (text) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return text.replace(regex, '<mark style="background-color: #FFF3CD; padding: 2px 4px; border-radius: 2px;">$1</mark>');
  };

  const toggleVisibility = (id) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === id) {
          return { ...section, visible: !section.visible };
        }
        if (section.subjects) {
          return { ...section, subjects: updateSections(section.subjects) };
        }
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const deleteSection = (id) => {
    const removeSections = (sectionList) => {
      return sectionList
        .filter(section => section.id !== id)
        .map(section => ({
          ...section,
          subjects: section.subjects ? removeSections(section.subjects) : []
        }));
    };
    setSections(removeSections(sections));
    if (selectedSection?.id === id) {
      setSelectedSection(sections[0]);
    }
  };

  const moveSection = (id, direction) => {
    const moveSections = (sectionList) => {
      const idx = sectionList.findIndex(s => s.id === id);
      if (idx === -1) {
        return sectionList.map(section => ({
          ...section,
          subjects: section.subjects ? moveSections(section.subjects) : []
        }));
      }

      if (direction === 'up' && idx > 0) {
        const newList = [...sectionList];
        [newList[idx - 1], newList[idx]] = [newList[idx], newList[idx - 1]];
        return newList;
      }

      if (direction === 'down' && idx < sectionList.length - 1) {
        const newList = [...sectionList];
        [newList[idx], newList[idx + 1]] = [newList[idx + 1], newList[idx]];
        return newList;
      }

      return sectionList;
    };

    setSections(moveSections(sections));
  };

  const updateSectionTitle = (id, newTitle) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === id) {
          const updated = { ...section, title: newTitle };
          if (selectedSection?.id === id) {
            setSelectedSection(updated);
          }
          return updated;
        }
        if (section.subjects) {
          return { ...section, subjects: updateSections(section.subjects) };
        }
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const updateSubjectContent = (sectionId, subjectId, newContent) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          const updatedSubjects = section.subjects.map(subject => {
            if (subject.id === subjectId) {
              return { ...subject, content: newContent };
            }
            return subject;
          });
          const updated = { ...section, subjects: updatedSubjects };
          if (selectedSection?.id === sectionId) {
            setSelectedSection(updated);
          }
          return updated;
        }
        if (section.subjects) {
          return { ...section, subjects: updateSections(section.subjects) };
        }
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const updateSubjectTitle = (sectionId, subjectId, newTitle) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          const updatedSubjects = section.subjects.map(subject => {
            if (subject.id === subjectId) {
              return { ...subject, title: newTitle };
            }
            return subject;
          });
          const updated = { ...section, subjects: updatedSubjects };
          if (selectedSection?.id === sectionId) {
            setSelectedSection(updated);
          }
          return updated;
        }
        if (section.subjects) {
          return { ...section, subjects: updateSections(section.subjects) };
        }
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const addNewSection = () => {
    const newSection = {
      id: Date.now() + Math.random(),
      level: 1,
      title: 'New Section',
      content: '',
      visible: true,
      subjects: []
    };
    setSections([...sections, newSection]);
    setSelectedSection(newSection);
  };

  const addNewSubject = (sectionId) => {
    const newSubject = {
      id: Date.now() + Math.random(),
      level: 2,
      title: 'New Subsection',
      content: 'Add your content here...',
      visible: true,
      subjects: []
    };

    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          const updated = {
            ...section,
            subjects: [...(section.subjects || []), newSubject]
          };
          setSelectedSection(updated);
          setExpandedSubjects(prev => {
            const newSet = new Set(prev);
            newSet.add(newSubject.id);
            return newSet;
          });
          return updated;
        }
        if (section.subjects) {
          return { ...section, subjects: updateSections(section.subjects) };
        }
        return section;
      });
    };

    setSections(updateSections(sections));
  };

  const deleteSubject = (sectionId, subjectId) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          const updatedSubjects = section.subjects.filter(s => s.id !== subjectId);
          const updated = { ...section, subjects: updatedSubjects };
          if (selectedSection?.id === sectionId) {
            setSelectedSection(updated);
          }
          return updated;
        }
        if (section.subjects) {
          return { ...section, subjects: updateSections(section.subjects) };
        }
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const reconstructPrompt = () => {
    let output = [];

    const processSection = (section, depth = 1) => {
      if (!section.visible) return;

      if (section.level === 2 && section.title.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        output.push(`<${section.title}>`);
        if (section.content) output.push(section.content);
        if (section.subjects && section.subjects.length > 0) {
          section.subjects.forEach(child => processSection(child, depth + 1));
        }
        output.push(`</${section.title}>`);
        output.push('');
      } else {
        const prefix = '#'.repeat(depth);
        output.push(`${prefix} ${section.title}`);
        if (section.content) {
          output.push('');
          output.push(section.content);
          output.push('');
        }
        if (section.subjects && section.subjects.length > 0) {
          section.subjects.forEach(child => processSection(child, depth + 1));
        }
      }
    };

    sections.forEach(section => processSection(section));
    return output.join('\n');
  };

  const copyToClipboard = () => {
    const text = reconstructPrompt();
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const downloadPrompt = () => {
    const text = reconstructPrompt();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'organized-prompt.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetToInput = () => {
    setParseMode(false);
    setSections([]);
    setSelectedSection(null);
    setExpandedSubjects(new Set());
    setSearchQuery('');
  };

  if (!parseMode) {
    return (
      <div className="app-container">
        <div className="header">
          <h1>Prompt Organizer</h1>
          <p>Parse and organize your system prompts</p>
        </div>
        <div className="input-container">
          <textarea
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            placeholder="Paste your long system prompt here...

The parser recognizes:
- Markdown headers (# H1, ## H2, ### H3)
- XML-style tags (<section_name>...</section_name>)
- Preserves code blocks and formatting"
            className="input-textarea"
          />
          <button
            onClick={handleParse}
            disabled={!rawPrompt.trim()}
            className={`parse-button ${!rawPrompt.trim() ? 'disabled' : ''}`}
          >
            Parse Prompt →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="tabs">
        <button
          onClick={() => setActiveTab('edit')}
          className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
        >
          ✏️ Edit Sections
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
        >
          👁️ Live Preview
        </button>
      </div>

      {activeTab === 'edit' ? (
        <div className="main-layout">
          <div className="sidebar">
            <div className="sidebar-header">
              <h2>Sections</h2>
              <p>{sections.length} top-level sections</p>
            </div>
            <div className="sidebar-actions">
              <button onClick={resetToInput} className="action-btn secondary">← Back</button>
              <button onClick={copyToClipboard} className="action-btn primary">📋</button>
              <button onClick={downloadPrompt} className="action-btn primary">💾</button>
            </div>
            <nav className="section-list">
              {sections.map((section, index) => (
                <div key={section.id}>
                  <button
                    onClick={() => setSelectedSection(section)}
                    className={`section-item ${selectedSection?.id === section.id ? 'active' : ''}`}
                    style={{ opacity: section.visible ? 1 : 0.5 }}
                  >
                    <span className="section-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="section-title">{section.title}</span>
                    {showActions && (
                      <div className="section-actions" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleVisibility(section.id)} title={section.visible ? 'Hide' : 'Show'}>
                          {section.visible ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button onClick={() => moveSection(section.id, 'up')}>↑</button>
                        <button onClick={() => moveSection(section.id, 'down')}>↓</button>
                        <button onClick={() => deleteSection(section.id)} className="delete">🗑️</button>
                      </div>
                    )}
                  </button>
                </div>
              ))}
              <button onClick={addNewSection} className="add-section-btn">
                + Add New Section
              </button>
            </nav>
          </div>

          <div className="content-area">
            <div className="content-inner">
              {showSearch && (
                <input
                  type="text"
                  placeholder="Search in this section..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              )}

              <div className="section-title-row">
                <input
                  type="text"
                  value={selectedSection?.title || ''}
                  onChange={(e) => updateSectionTitle(selectedSection.id, e.target.value)}
                  className="section-title-input"
                  placeholder="Section Title"
                />
                <button onClick={() => addNewSubject(selectedSection.id)} className="add-subsection-btn">
                  + Add Subsection
                </button>
              </div>

              <div className="subjects-list">
                {selectedSection?.subjects?.map((subject) => {
                  const shouldShow = !searchQuery || filterContent(subject.title) || filterContent(subject.content);
                  if (!shouldShow) return null;

                  const isEditing = editingSubject === subject.id;

                  return (
                    <div key={subject.id} className="subject-card">
                      <div className="subject-header">
                        {isEditing ? (
                          <input
                            type="text"
                            value={subject.title}
                            onChange={(e) => updateSubjectTitle(selectedSection.id, subject.id, e.target.value)}
                            onBlur={() => setEditingSubject(null)}
                            autoFocus
                            className="subject-title-edit"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingSubject(null);
                            }}
                          />
                        ) : (
                          <span
                            onClick={() => setEditingSubject(subject.id)}
                            className="subject-title"
                            dangerouslySetInnerHTML={{ __html: highlightText(subject.title) }}
                          />
                        )}
                        <div className="subject-actions">
                          <button onClick={() => deleteSubject(selectedSection.id, subject.id)} className="delete">🗑️</button>
                          <button onClick={() => toggleSubject(subject.id)}>
                            {isSubjectExpanded(subject.id) ? '▼' : '▶'}
                          </button>
                        </div>
                      </div>

                      {isSubjectExpanded(subject.id) && (
                        <div className="subject-content">
                          <textarea
                            value={subject.content}
                            onChange={(e) => updateSubjectContent(selectedSection.id, subject.id, e.target.value)}
                            className="subject-textarea"
                            placeholder="Enter content here... (supports markdown)"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="preview-container">
          <div className="preview-header">
            <div>
              <h2>Live Preview</h2>
              <p>{sections.filter(s => s.visible).length} visible sections • Ready to copy or download</p>
            </div>
            <div className="preview-actions">
              <button onClick={copyToClipboard} className="action-btn primary">
                <span>📋</span> Copy to Clipboard
              </button>
              <button onClick={downloadPrompt} className="action-btn primary">
                <span>💾</span> Download
              </button>
            </div>
          </div>
          <div className="preview-content">
            <div className="preview-box">
              <pre>{reconstructPrompt()}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default App;