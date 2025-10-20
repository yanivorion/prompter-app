import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

// Lucide React Icons (shadcn uses these)
import { 
  Menu, 
  ChevronDown, 
  ChevronRight,
  File, 
  FolderOpen,
  Search,
  Copy,
  Download,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  X,
  Edit3
} from 'lucide-react';

function App() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [parseMode, setParseMode] = useState(false);
  const [rawPrompt, setRawPrompt] = useState('');
  const [activeTab, setActiveTab] = useState('edit');
  const [editingSubject, setEditingSubject] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contentRefs = useRef({});

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

  // Input mode
  if (!parseMode) {
    return (
      <div className="app-container">
        <motion.div 
          className="header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1>Prompter</h1>
          <p>Parse and organize your system prompts</p>
        </motion.div>
        <motion.div 
          className="input-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
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
          <motion.button
            onClick={handleParse}
            disabled={!rawPrompt.trim()}
            className={`parse-button ${!rawPrompt.trim() ? 'disabled' : ''}`}
            whileHover={rawPrompt.trim() ? { scale: 1.02 } : {}}
            whileTap={rawPrompt.trim() ? { scale: 0.98 } : {}}
          >
            Parse Prompt →
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Main view with collapsible sidebar
  return (
    <div className="app-container">
      {/* Tabs */}
      <div className="tabs">
        <motion.button
          onClick={() => setActiveTab('edit')}
          className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
          whileHover={{ backgroundColor: activeTab !== 'edit' ? '#E9ECEF' : undefined }}
          whileTap={{ scale: 0.98 }}
        >
          <Edit3 size={16} />
          <span>Edit Sections</span>
        </motion.button>
        <motion.button
          onClick={() => setActiveTab('preview')}
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          whileHover={{ backgroundColor: activeTab !== 'preview' ? '#E9ECEF' : undefined }}
          whileTap={{ scale: 0.98 }}
        >
          <Eye size={16} />
          <span>Live Preview</span>
        </motion.button>
      </div>

      {activeTab === 'edit' ? (
        <div className="main-layout">
          {/* Collapsible Sidebar */}
          <motion.div 
            className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
            animate={{ width: sidebarCollapsed ? '80px' : '280px' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Toggle Button */}
            <div className="sidebar-toggle">
              <motion.button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="toggle-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Menu size={20} />
              </motion.button>
            </div>

            {/* Sidebar Header */}
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div
                  className="sidebar-header"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2>Sections</h2>
                  <p>{sections.length} sections</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sidebar Actions */}
            <div className="sidebar-actions">
              <motion.button
                onClick={resetToInput}
                className="action-icon-btn"
                title="Back to input"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={18} />
              </motion.button>
              <motion.button
                onClick={copyToClipboard}
                className="action-icon-btn"
                title="Copy to clipboard"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Copy size={18} />
              </motion.button>
              <motion.button
                onClick={downloadPrompt}
                className="action-icon-btn"
                title="Download"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Download size={18} />
              </motion.button>
            </div>

            {/* Section List */}
            <nav className="section-list">
              {sections.map((section, index) => (
                <motion.button
                  key={section.id}
                  onClick={() => setSelectedSection(section)}
                  className={`section-item ${selectedSection?.id === section.id ? 'active' : ''}`}
                  style={{ opacity: section.visible ? 1 : 0.5 }}
                  whileHover={{ x: sidebarCollapsed ? 0 : 4 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: section.visible ? 1 : 0.5, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <div className="section-icon">
                    <File size={18} />
                  </div>
                  <AnimatePresence mode="wait">
                    {!sidebarCollapsed && (
                      <motion.div
                        className="section-content"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="section-title">{section.title}</span>
                        <div className="section-actions" onClick={(e) => e.stopPropagation()}>
                          <motion.button
                            onClick={() => toggleVisibility(section.id)}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </motion.button>
                          <motion.button
                            onClick={() => moveSection(section.id, 'up')}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <ArrowUp size={14} />
                          </motion.button>
                          <motion.button
                            onClick={() => moveSection(section.id, 'down')}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <ArrowDown size={14} />
                          </motion.button>
                          <motion.button
                            onClick={() => deleteSection(section.id)}
                            className="delete"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 size={14} />
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))}
              
              <motion.button
                onClick={addNewSection}
                className="add-section-btn"
                whileHover={{ scale: sidebarCollapsed ? 1.1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus size={18} />
                {!sidebarCollapsed && <span>Add Section</span>}
              </motion.button>
            </nav>
          </motion.div>

          {/* Content Area */}
          <div className="content-area">
            <div className="content-inner">
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search in this section..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="section-title-row">
                <input
                  type="text"
                  value={selectedSection?.title || ''}
                  onChange={(e) => updateSectionTitle(selectedSection.id, e.target.value)}
                  className="section-title-input"
                  placeholder="Section Title"
                />
                <motion.button
                  onClick={() => addNewSubject(selectedSection.id)}
                  className="add-subsection-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus size={16} />
                  <span>Add Subsection</span>
                </motion.button>
              </div>

              <div className="subjects-list">
                <AnimatePresence>
                  {selectedSection?.subjects?.map((subject, index) => {
                    const shouldShow = !searchQuery || filterContent(subject.title) || filterContent(subject.content);
                    if (!shouldShow) return null;

                    const isEditing = editingSubject === subject.id;
                    const isExpanded = isSubjectExpanded(subject.id);

                    return (
                      <motion.div
                        key={subject.id}
                        className="subject-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                        layout
                      >
                        <motion.div className="subject-header" whileHover={{ backgroundColor: '#F8F9FA' }}>
                          <motion.button
                            onClick={() => toggleSubject(subject.id)}
                            className="expand-btn"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight size={18} />
                            </motion.div>
                          </motion.button>

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
                            <motion.button
                              onClick={() => deleteSubject(selectedSection.id, subject.id)}
                              className="delete"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Trash2 size={16} />
                            </motion.button>
                          </div>
                        </motion.div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              className="subject-content"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            >
                              <textarea
                                value={subject.content}
                                onChange={(e) => updateSubjectContent(selectedSection.id, subject.id, e.target.value)}
                                className="subject-textarea"
                                placeholder="Enter content here... (supports markdown)"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Preview Mode
        <motion.div
          className="preview-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="preview-header">
            <div>
              <h2>Live Preview</h2>
              <p>{sections.filter(s => s.visible).length} visible sections</p>
            </div>
            <div className="preview-actions">
              <motion.button
                onClick={copyToClipboard}
                className="action-btn primary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Copy size={16} />
                <span>Copy</span>
              </motion.button>
              <motion.button
                onClick={downloadPrompt}
                className="action-btn primary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Download size={16} />
                <span>Download</span>
              </motion.button>
            </div>
          </div>
          <div className="preview-content">
            <motion.div
              className="preview-box"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <pre>{reconstructPrompt()}</pre>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default App;