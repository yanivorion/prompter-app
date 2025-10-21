import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

import { 
  Menu, ChevronDown, ChevronRight, ChevronUp, File, Search,
  Copy, Download, Eye, EyeOff, Trash2, Plus, X
} from 'lucide-react';

function App() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [parseMode, setParseMode] = useState(false);
  const [rawPrompt, setRawPrompt] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editPanelVisible, setEditPanelVisible] = useState(true);
  const [previewPanelVisible, setPreviewPanelVisible] = useState(true);

  const parsePrompt = (text) => {
    const lines = text.split('\n');
    const parsed = [];
    let currentH1 = null, currentH2 = null, currentH3 = null;
    let buffer = [], inCodeBlock = false, inXmlBlock = false, xmlBlockName = '';

    const createSection = (level, title, content = '') => ({
      id: Date.now() + Math.random(), level, title: title.trim(),
      content: content.trim(), visible: true, subjects: []
    });

    const saveBuffer = () => {
      const content = buffer.join('\n').trim();
      if (currentH3) currentH3.content = content;
      else if (currentH2) currentH2.content = content;
      else if (currentH1) currentH1.content = content;
      buffer = [];
    };

    lines.forEach((line) => {
      if (line.trim().startsWith('```')) { inCodeBlock = !inCodeBlock; buffer.push(line); return; }
      if (inCodeBlock) { buffer.push(line); return; }

      const xmlOpenMatch = line.match(/^<([a-zA-Z_][a-zA-Z0-9_]*)>$/);
      if (xmlOpenMatch && !inXmlBlock) {
        saveBuffer(); inXmlBlock = true; xmlBlockName = xmlOpenMatch[1];
        currentH2 = createSection(2, xmlBlockName);
        if (currentH1) currentH1.subjects.push(currentH2);
        else parsed.push(currentH2);
        currentH3 = null; return;
      }

      const xmlCloseMatch = line.match(/^<\/([a-zA-Z_][a-zA-Z0-9_]*)>$/);
      if (xmlCloseMatch && inXmlBlock && xmlCloseMatch[1] === xmlBlockName) {
        saveBuffer(); inXmlBlock = false; xmlBlockName = ''; return;
      }

      if (inXmlBlock) { buffer.push(line); return; }

      if (line.match(/^#\s+[^#]/)) {
        saveBuffer(); const title = line.replace(/^#\s+/, '');
        currentH1 = createSection(1, title); parsed.push(currentH1);
        currentH2 = null; currentH3 = null;
      } else if (line.match(/^##\s+[^#]/)) {
        saveBuffer(); const title = line.replace(/^##\s+/, '');
        currentH2 = createSection(2, title);
        if (currentH1) currentH1.subjects.push(currentH2);
        else parsed.push(currentH2);
        currentH3 = null;
      } else if (line.match(/^###\s+[^#]/)) {
        saveBuffer(); const title = line.replace(/^###\s+/, '');
        currentH3 = createSection(3, title);
        if (currentH2) currentH2.subjects.push(currentH3);
        else if (currentH1) currentH1.subjects.push(currentH3);
        else parsed.push(currentH3);
      } else buffer.push(line);
    });

    saveBuffer();
    return parsed;
  };

  const handleParse = () => {
    const parsed = parsePrompt(rawPrompt);
    setSections(parsed);
    if (parsed.length > 0) {
      setSelectedSection(parsed[0]);
      const allIds = new Set();
      parsed.forEach(section => section.subjects?.forEach(subject => allIds.add(subject.id)));
      setExpandedSubjects(allIds);
    }
    setParseMode(true);
  };

  const toggleSubject = (id) => {
    setExpandedSubjects(prev => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const toggleVisibility = (id) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === id) return { ...section, visible: !section.visible };
        if (section.subjects) return { ...section, subjects: updateSections(section.subjects) };
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const deleteSection = (id) => {
    const removeSections = (sectionList) => {
      return sectionList.filter(section => section.id !== id).map(section => ({
        ...section, subjects: section.subjects ? removeSections(section.subjects) : []
      }));
    };
    setSections(removeSections(sections));
    if (selectedSection?.id === id) setSelectedSection(sections[0]);
  };

  const updateSectionTitle = (id, newTitle) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === id) {
          const updated = { ...section, title: newTitle };
          if (selectedSection?.id === id) setSelectedSection(updated);
          return updated;
        }
        if (section.subjects) return { ...section, subjects: updateSections(section.subjects) };
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const updateSubjectContent = (sectionId, subjectId, newContent) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          const updatedSubjects = section.subjects.map(subject => 
            subject.id === subjectId ? { ...subject, content: newContent } : subject
          );
          const updated = { ...section, subjects: updatedSubjects };
          if (selectedSection?.id === sectionId) setSelectedSection(updated);
          return updated;
        }
        if (section.subjects) return { ...section, subjects: updateSections(section.subjects) };
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const updateSubjectTitle = (sectionId, subjectId, newTitle) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          const updatedSubjects = section.subjects.map(subject => 
            subject.id === subjectId ? { ...subject, title: newTitle } : subject
          );
          const updated = { ...section, subjects: updatedSubjects };
          if (selectedSection?.id === sectionId) setSelectedSection(updated);
          return updated;
        }
        if (section.subjects) return { ...section, subjects: updateSections(section.subjects) };
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const addNewSection = () => {
    const newSection = {
      id: Date.now() + Math.random(), level: 1, title: 'New Section',
      content: '', visible: true, subjects: []
    };
    setSections([...sections, newSection]);
    setSelectedSection(newSection);
  };

  const addNewSubject = (sectionId) => {
    const newSubject = {
      id: Date.now() + Math.random(), level: 2, title: 'New Subsection',
      content: 'Add your content here...', visible: true, subjects: []
    };

    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          const updated = { ...section, subjects: [...(section.subjects || []), newSubject] };
          setSelectedSection(updated);
          setExpandedSubjects(prev => { const newSet = new Set(prev); newSet.add(newSubject.id); return newSet; });
          return updated;
        }
        if (section.subjects) return { ...section, subjects: updateSections(section.subjects) };
        return section;
      });
    };

    setSections(updateSections(sections));
  };

  const deleteSubject = (sectionId, subjectId) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          const updated = { ...section, subjects: section.subjects.filter(s => s.id !== subjectId) };
          if (selectedSection?.id === sectionId) setSelectedSection(updated);
          return updated;
        }
        if (section.subjects) return { ...section, subjects: updateSections(section.subjects) };
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
        if (section.subjects?.length > 0) section.subjects.forEach(child => processSection(child, depth + 1));
        output.push(`</${section.title}>`, '');
      } else {
        const prefix = '#'.repeat(depth);
        output.push(`${prefix} ${section.title}`);
        if (section.content) output.push('', section.content, '');
        if (section.subjects?.length > 0) section.subjects.forEach(child => processSection(child, depth + 1));
      }
    };
    sections.forEach(section => processSection(section));
    return output.join('\n');
  };

  const copyToClipboard = () => navigator.clipboard.writeText(reconstructPrompt());
  
  const downloadPrompt = () => {
    const text = reconstructPrompt();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'organized-prompt.md'; a.click();
    URL.revokeObjectURL(url);
  };

  const resetToInput = () => {
    setParseMode(false); setSections([]); setSelectedSection(null);
    setExpandedSubjects(new Set()); setSearchQuery('');
  };

  if (!parseMode) {
    return (
      <div className="app-container">
        <motion.div className="header" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1>PROMPTER</h1>
          <p>Parse and organize your system prompts</p>
        </motion.div>
        <motion.div className="input-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.3 }}>
          <textarea value={rawPrompt} onChange={(e) => setRawPrompt(e.target.value)}
            placeholder="Paste your long system prompt here...

The parser recognizes:
- Markdown headers (# H1, ## H2, ### H3)
- XML-style tags (<section_name>...</section_name>)
- Preserves code blocks and formatting"
            className="input-textarea"
          />
          <motion.button onClick={handleParse} disabled={!rawPrompt.trim()}
            className={`parse-button ${!rawPrompt.trim() ? 'disabled' : ''}`}
            whileHover={rawPrompt.trim() ? { scale: 1.02 } : {}} whileTap={rawPrompt.trim() ? { scale: 0.98 } : {}}>
            Parse Prompt
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="top-bar-left">
          <motion.button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="icon-btn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Menu size={20} />
          </motion.button>
          <div className="top-bar-actions">
            <motion.button onClick={resetToInput} className="icon-btn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><X size={18} /></motion.button>
            <motion.button onClick={copyToClipboard} className="icon-btn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><Copy size={18} /></motion.button>
            <motion.button onClick={downloadPrompt} className="icon-btn" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><Download size={18} /></motion.button>
          </div>
        </div>
      </div>

      <div className="main-layout">
        <motion.div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
          animate={{ width: sidebarCollapsed ? '70px' : '240px' }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.div className="sidebar-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <h2>Sections</h2>
                <p>{sections.length} sections</p>
              </motion.div>
            )}
          </AnimatePresence>

          <nav className="section-list">
            {sections.map((section) => (
              <motion.button key={section.id} onClick={() => setSelectedSection(section)}
                className={`section-item ${selectedSection?.id === section.id ? 'active' : ''}`}
                style={{ opacity: section.visible ? 1 : 0.5 }}
                whileHover={{ x: sidebarCollapsed ? 0 : 2 }} whileTap={{ scale: 0.98 }}>
                <div className="section-icon"><File size={18} /></div>
                <AnimatePresence mode="wait">
                  {!sidebarCollapsed && (
                    <motion.div className="section-content" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }}>
                      <span className="section-title">{section.title}</span>
                      <div className="section-actions" onClick={(e) => e.stopPropagation()}>
                        <motion.button onClick={() => toggleVisibility(section.id)} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                          {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </motion.button>
                        <motion.button onClick={() => deleteSection(section.id)} className="delete" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
            <motion.button onClick={addNewSection} className="add-section-btn"
              whileHover={{ scale: sidebarCollapsed ? 1.1 : 1.02 }} whileTap={{ scale: 0.98 }}>
              <Plus size={18} />
              {!sidebarCollapsed && <span>Add Section</span>}
            </motion.button>
          </nav>
        </motion.div>

        <div className="content-wrapper">
          <AnimatePresence>
            {editPanelVisible && (
              <motion.div className="content-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                <div className="panel-header">
                  <h3>EDIT SECTIONS</h3>
                  <motion.button onClick={() => setEditPanelVisible(false)} className="collapse-btn"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><ChevronUp size={20} /></motion.button>
                </div>
                <div className="panel-content">
                  <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Search in this section..." value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                  </div>

                  <div className="section-title-row">
                    <input type="text" value={selectedSection?.title || ''}
                      onChange={(e) => updateSectionTitle(selectedSection?.id, e.target.value)}
                      className="section-title-input" placeholder="Section Title" />
                    <motion.button onClick={() => addNewSubject(selectedSection?.id)} className="add-btn"
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Plus size={16} /> ADD SUBSECTION
                    </motion.button>
                  </div>

                  <div className="subjects-list">
                    {selectedSection?.subjects?.map((subject) => {
                      const isExpanded = expandedSubjects.has(subject.id);
                      return (
                        <motion.div key={subject.id} className="subject-card" layout>
                          <div className="subject-header">
                            <motion.button onClick={() => toggleSubject(subject.id)} className="expand-btn"
                              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronRight size={16} />
                              </motion.div>
                            </motion.button>
                            <input type="text" value={subject.title}
                              onChange={(e) => updateSubjectTitle(selectedSection?.id, subject.id, e.target.value)}
                              className="subject-title-input" />
                            <motion.button onClick={() => deleteSubject(selectedSection?.id, subject.id)}
                              className="delete-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Trash2 size={16} />
                            </motion.button>
                          </div>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div className="subject-content" initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                                <textarea value={subject.content}
                                  onChange={(e) => updateSubjectContent(selectedSection?.id, subject.id, e.target.value)}
                                  className="subject-textarea" placeholder="Add your content here..." />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!editPanelVisible && (
              <motion.div className="expand-button-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.button onClick={() => setEditPanelVisible(true)} className="expand-panel-btn"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <ChevronDown size={20} /> <span>EDIT SECTIONS</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {editPanelVisible && previewPanelVisible && <div className="breathing-space" />}

          <AnimatePresence>
            {previewPanelVisible && (
              <motion.div className="content-panel preview-panel" initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                <div className="panel-header">
                  <h3>LIVE PREVIEW</h3>
                  <motion.button onClick={() => setPreviewPanelVisible(false)} className="collapse-btn"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><ChevronUp size={20} /></motion.button>
                </div>
                <div className="panel-content">
                  <div className="preview-stats">
                    <span>{sections.filter(s => s.visible).length} visible sections</span>
                  </div>
                  <div className="preview-box">
                    <pre>{reconstructPrompt()}</pre>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!previewPanelVisible && (
              <motion.div className="expand-button-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.button onClick={() => setPreviewPanelVisible(true)} className="expand-panel-btn"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <ChevronDown size={20} /> <span>LIVE PREVIEW</span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default App;