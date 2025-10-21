import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

// Lucide React Icons
import { 
  Menu, 
  ChevronDown, 
  ChevronRight,
  File, 
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
  GripVertical
} from 'lucide-react';

function App() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [parseMode, setParseMode] = useState(false);
  const [rawPrompt, setRawPrompt] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [splitView, setSplitView] = useState(true);
  const [splitPosition, setSplitPosition] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);

  // NEW: Analytics state
  const [currentView, setCurrentView] = useState('editor'); // 'editor' or 'analytics'
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState('overview');
  const fileInputRef = useRef(null);

  // Load analytics data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('componentAnalytics');
    if (stored) {
      try {
        setAnalyticsData(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load analytics:', e);
      }
    }
  }, []);

  // Parse analysis file
  const parseAnalysisFile = (fileContent) => {
    try {
      const requestMatch = fileContent.match(/original:\s*['"](.*?)['"]/);
      const triggersMatch = fileContent.match(/triggers:\s*\[([\s\S]*?)\]/);
      let triggers = [];
      
      if (triggersMatch) {
        const triggersStr = triggersMatch[1];
        const triggerMatches = triggersStr.matchAll(/{\s*name:\s*['"](.+?)['"]\s*,\s*relevance:\s*(\d+)\s*,\s*reason:\s*['"](.+?)['"]\s*}/g);
        triggers = Array.from(triggerMatches).map(match => ({
          name: match[1],
          relevance: parseInt(match[2]),
          reason: match[3]
        }));
      }

      const decisionsMatch = fileContent.match(/decisions\s*=\s*\[([\s\S]*?)\];/);
      let decisions = [];
      
      if (decisionsMatch) {
        const decisionsStr = decisionsMatch[1];
        const decisionMatches = decisionsStr.matchAll(/{\s*title:\s*['"](.+?)['"]\s*,\s*reason:\s*['"](.+?)['"]/g);
        decisions = Array.from(decisionMatches).map(match => ({
          title: match[1],
          reason: match[2]
        }));
      }

      const typeMatch = fileContent.match(/ComponentB_GenerationAnalysis_(\w+)/);
      const componentType = typeMatch ? typeMatch[1] : 'Unknown';

      return {
        componentType,
        request: requestMatch ? requestMatch[1] : 'Unknown request',
        triggers: triggers,
        decisions: decisions,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0]
      };
    } catch (e) {
      console.error('Failed to parse file:', e);
      return null;
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    setIsProcessing(true);
    const newComponents = [];

    for (let file of files) {
      if (file.name.includes('ComponentB_GenerationAnalysis')) {
        const text = await file.text();
        const parsed = parseAnalysisFile(text);
        if (parsed) {
          newComponents.push(parsed);
        }
      }
    }

    if (newComponents.length > 0) {
      const existing = analyticsData?.components || [];
      const updated = {
        components: [...existing, ...newComponents],
        lastUpdated: Date.now(),
        totalComponents: existing.length + newComponents.length
      };

      setAnalyticsData(updated);
      localStorage.setItem('componentAnalytics', JSON.stringify(updated));
    }

    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Calculate statistics
  const calculateStatistics = () => {
    if (!analyticsData?.components?.length) return null;

    const components = analyticsData.components;
    const allTriggers = components.flatMap(c => c.triggers || []);
    
    const triggerStats = {};
    allTriggers.forEach(t => {
      if (!triggerStats[t.name]) {
        triggerStats[t.name] = {
          count: 0,
          totalRelevance: 0,
          relevances: []
        };
      }
      triggerStats[t.name].count++;
      triggerStats[t.name].totalRelevance += t.relevance;
      triggerStats[t.name].relevances.push(t.relevance);
    });

    const triggerArray = Object.entries(triggerStats).map(([name, data]) => ({
      name,
      count: data.count,
      percentage: ((data.count / components.length) * 100).toFixed(1),
      avgRelevance: (data.totalRelevance / data.count).toFixed(1),
      minRelevance: Math.min(...data.relevances),
      maxRelevance: Math.max(...data.relevances)
    })).sort((a, b) => b.count - a.count);

    const decisionStats = {};
    components.forEach(c => {
      c.decisions?.forEach(d => {
        decisionStats[d.title] = (decisionStats[d.title] || 0) + 1;
      });
    });

    const decisionArray = Object.entries(decisionStats)
      .map(([title, count]) => ({
        title,
        count,
        percentage: ((count / components.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);

    const typeStats = {};
    components.forEach(c => {
      typeStats[c.componentType] = (typeStats[c.componentType] || 0) + 1;
    });

    const dateGroups = {};
    components.forEach(c => {
      const date = c.date || new Date(c.timestamp).toISOString().split('T')[0];
      dateGroups[date] = (dateGroups[date] || 0) + 1;
    });

    const timeline = Object.entries(dateGroups)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total: components.length,
      triggers: triggerArray,
      decisions: decisionArray,
      types: typeStats,
      timeline,
      avgTriggersPerComponent: (allTriggers.length / components.length).toFixed(1),
      avgDecisionsPerComponent: (components.reduce((sum, c) => sum + (c.decisions?.length || 0), 0) / components.length).toFixed(1)
    };
  };

  const stats = calculateStatistics();

  const clearAnalytics = () => {
    if (window.confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
      setAnalyticsData(null);
      localStorage.removeItem('componentAnalytics');
    }
  };

  const exportAnalytics = () => {
    if (!analyticsData) return;
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `component-analytics-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Analytics views
  const renderAnalyticsContent = () => {
    if (!stats) {
      return (
        <div style={{ textAlign: 'center', padding: '80px 40px' }}>
          <Upload size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '400', marginBottom: '8px', letterSpacing: '0.01em' }}>
            No Analytics Data Yet
          </h2>
          <p style={{ color: '#666', marginBottom: '24px', fontSize: '13px' }}>
            Upload ComponentB analysis files to start tracking patterns
          </p>
          <button onClick={() => fileInputRef.current?.click()} className="parse-button">
            Upload Analysis Files
          </button>
        </div>
      );
    }

    switch (analyticsTab) {
      case 'overview':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '400', marginBottom: '24px', letterSpacing: '0.01em' }}>
              Analytics Overview
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
              <div className="subject-card" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Components
                </div>
                <div style={{ fontSize: '32px', fontWeight: '400' }}>{stats.total}</div>
              </div>
              <div className="subject-card" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Avg Triggers
                </div>
                <div style={{ fontSize: '32px', fontWeight: '400' }}>{stats.avgTriggersPerComponent}</div>
              </div>
              <div className="subject-card" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Avg Patterns
                </div>
                <div style={{ fontSize: '32px', fontWeight: '400' }}>{stats.avgDecisionsPerComponent}</div>
              </div>
              <div className="subject-card" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Component Types
                </div>
                <div style={{ fontSize: '32px', fontWeight: '400' }}>{Object.keys(stats.types).length}</div>
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '16px', letterSpacing: '0.02em' }}>
                Top Prompt Sections
              </h3>
              <div className="subjects-list">
                {stats.triggers.slice(0, 5).map((trigger, idx) => (
                  <div key={idx} className="subject-card">
                    <div className="subject-header" style={{ borderBottom: 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px', fontSize: '14px' }}>{trigger.name}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          Used in {trigger.count} components ({trigger.percentage}%)
                        </div>
                      </div>
                      <div style={{ 
                        padding: '6px 12px', 
                        background: '#1A1A1A',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {trigger.avgRelevance}% avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '16px', letterSpacing: '0.02em' }}>
                Top Design Patterns
              </h3>
              <div className="subjects-list">
                {stats.decisions.slice(0, 5).map((decision, idx) => (
                  <div key={idx} className="subject-card">
                    <div className="subject-header" style={{ borderBottom: 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px', fontSize: '14px' }}>{decision.title}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          Used in {decision.count} components ({decision.percentage}%)
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'triggers':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '400', marginBottom: '24px', letterSpacing: '0.01em' }}>
              Prompt Section Analysis
            </h2>
            <div className="subjects-list">
              {stats.triggers.map((trigger, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="subject-card"
                >
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>{trigger.name}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          Used in {trigger.count} of {stats.total} components ({trigger.percentage}%)
                        </div>
                      </div>
                      <div style={{ 
                        padding: '4px 10px',
                        background: '#1A1A1A',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        marginLeft: '12px'
                      }}>
                        {trigger.avgRelevance}% avg
                      </div>
                    </div>
                    <div style={{ 
                      height: '6px', 
                      background: '#E5E5E5', 
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        height: '100%', 
                        background: '#1A1A1A', 
                        width: `${trigger.percentage}%`,
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '11px', 
                      color: '#666',
                      display: 'flex',
                      gap: '12px'
                    }}>
                      <span>Min: {trigger.minRelevance}%</span>
                      <span>Max: {trigger.maxRelevance}%</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'decisions':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '400', marginBottom: '24px', letterSpacing: '0.01em' }}>
              Design Pattern Analysis
            </h2>
            <div className="subjects-list">
              {stats.decisions.map((decision, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="subject-card"
                >
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontWeight: '500', fontSize: '14px', flex: 1 }}>{decision.title}</div>
                      <div style={{ 
                        padding: '4px 10px',
                        background: '#1A1A1A',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {decision.count}x
                      </div>
                    </div>
                    <div style={{ 
                      height: '4px', 
                      background: '#E5E5E5', 
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        height: '100%', 
                        background: '#1A1A1A', 
                        width: `${decision.percentage}%`,
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                      Adoption rate: {decision.percentage}%
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'timeline':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '400', marginBottom: '24px', letterSpacing: '0.01em' }}>
              Generation Timeline
            </h2>
            <div className="subjects-list">
              {stats.timeline.map((day, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="subject-card"
                >
                  <div style={{ 
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <div style={{ 
                      minWidth: '100px', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      fontFamily: "'SF Mono', 'Monaco', monospace"
                    }}>
                      {day.date}
                    </div>
                    <div style={{ flex: 1, height: '20px', background: '#E5E5E5', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ 
                        height: '100%', 
                        background: '#1A1A1A',
                        width: `${(day.count / Math.max(...stats.timeline.map(d => d.count))) * 100}%`,
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                    <div style={{ 
                      minWidth: '30px', 
                      textAlign: 'right',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}>
                      {day.count}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'types':
        return (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '400', marginBottom: '24px', letterSpacing: '0.01em' }}>
              Component Type Distribution
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {Object.entries(stats.types)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count], idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="subject-card"
                    style={{ padding: '24px', textAlign: 'center' }}
                  >
                    <div style={{ fontSize: '36px', fontWeight: '400', marginBottom: '8px' }}>{count}</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                      {type}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {((count / stats.total) * 100).toFixed(1)}% of total
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // [ALL YOUR EXISTING FUNCTIONS - keeping them exactly as they are]
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
      const allIds = new Set();
      parsed.forEach(section => {
        section.subjects?.forEach(subject => allIds.add(subject.id));
      });
      setExpandedSubjects(allIds);
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
    const updateTitle = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === id) {
          return { ...section, title: newTitle };
        }
        if (section.subjects) {
          return { ...section, subjects: updateTitle(section.subjects) };
        }
        return section;
      });
    };
    setSections(updateTitle(sections));
    if (selectedSection?.id === id) {
      setSelectedSection({ ...selectedSection, title: newTitle });
    }
  };

  const updateSubjectTitle = (sectionId, subjectId, newTitle) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            subjects: section.subjects?.map(subject =>
              subject.id === subjectId ? { ...subject, title: newTitle } : subject
            )
          };
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
          return {
            ...section,
            subjects: section.subjects?.map(subject =>
              subject.id === subjectId ? { ...subject, content: newContent } : subject
            )
          };
        }
        if (section.subjects) {
          return { ...section, subjects: updateSections(section.subjects) };
        }
        return section;
      });
    };
    setSections(updateSections(sections));
  };

  const addNewSubject = (sectionId) => {
    const newSubject = {
      id: Date.now() + Math.random(),
      level: 3,
      title: 'New Subsection',
      content: '',
      visible: true
    };

    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            subjects: [...(section.subjects || []), newSubject]
          };
        }
        if (section.subjects) {
          return { ...section, subjects: updateSections(section.subjects) };
        }
        return section;
      });
    };

    setSections(updateSections(sections));
    setExpandedSubjects(prev => new Set([...prev, newSubject.id]));
  };

  const deleteSubject = (sectionId, subjectId) => {
    const updateSections = (sectionList) => {
      return sectionList.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            subjects: section.subjects?.filter(subject => subject.id !== subjectId)
          };
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
    let output = '';

    const processSection = (section, depth = 0) => {
      if (!section.visible) return;

      const prefix = '#'.repeat(section.level) + ' ';
      output += prefix + section.title + '\n';

      if (section.content) {
        output += section.content + '\n';
      }

      output += '\n';

      if (section.subjects) {
        section.subjects.forEach(subject => processSection(subject, depth + 1));
      }
    };

    sections.forEach(section => processSection(section));
    return output.trim();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(reconstructPrompt());
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadPrompt = () => {
    const text = reconstructPrompt();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompt.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    if (newPosition > 20 && newPosition < 80) {
      setSplitPosition(newPosition);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Render
  return (
    <div className="app-container">
      {!parseMode ? (
        // Input Mode
        <>
          <div className="header">
            <h1>PROMPT ORGANIZER</h1>
            <p>Structure and manage your prompts efficiently</p>
          </div>
          <div className="input-container">
            <textarea
              className="input-textarea"
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              placeholder="Paste your markdown prompt here..."
            />
            <button
              className={`parse-button ${!rawPrompt.trim() ? 'disabled' : ''}`}
              onClick={handleParse}
              disabled={!rawPrompt.trim()}
            >
              Parse Prompt
            </button>
          </div>
        </>
      ) : (
        // Parsed Mode
        <>
          <div className="top-bar">
            <div className="top-bar-left">
              <motion.button
                className="icon-btn"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Menu size={18} />
              </motion.button>
              
              {/* View Tabs */}
              <div className="view-tabs">
                <button 
                  className={`view-tab ${currentView === 'editor' ? 'active' : ''}`}
                  onClick={() => setCurrentView('editor')}
                >
                  <File size={14} style={{ marginRight: '6px', display: 'inline' }} />
                  Editor
                </button>
                <button 
                  className={`view-tab ${currentView === 'analytics' ? 'active' : ''}`}
                  onClick={() => setCurrentView('analytics')}
                >
                  <BarChart3 size={14} style={{ marginRight: '6px', display: 'inline' }} />
                  Analytics
                  {stats && (
                    <span style={{ 
                      marginLeft: '6px',
                      padding: '2px 6px', 
                      background: 'rgba(255,255,255,0.3)', 
                      borderRadius: '10px', 
                      fontSize: '10px'
                    }}>
                      {stats.total}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="top-bar-actions">
              {currentView === 'editor' ? (
                <>
                  <motion.button
                    className="icon-btn"
                    onClick={copyToClipboard}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Copy to Clipboard"
                  >
                    <Copy size={18} />
                  </motion.button>
                  <motion.button
                    className="icon-btn"
                    onClick={downloadPrompt}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Download"
                  >
                    <Download size={18} />
                  </motion.button>
                  <motion.button
                    className="icon-btn"
                    onClick={() => setSplitView(!splitView)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title={splitView ? "Hide Preview" : "Show Preview"}
                  >
                    {splitView ? <EyeOff size={18} /> : <Eye size={18} />}
                  </motion.button>
                </>
              ) : (
                <>
                  {stats && (
                    <>
                      <motion.button
                        className="icon-btn"
                        onClick={exportAnalytics}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Export Data"
                      >
                        <Download size={18} />
                      </motion.button>
                      <motion.button
                        className="icon-btn"
                        onClick={clearAnalytics}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Clear Data"
                        style={{ color: '#DC3545' }}
                      >
                        <Trash2 size={18} />
                      </motion.button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="main-layout">
            {currentView === 'editor' ? (
              // Editor View (existing code)
              <>
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.div
                      className="sidebar"
                      style={{ width: '280px' }}
                      initial={{ x: -280 }}
                      animate={{ x: 0 }}
                      exit={{ x: -280 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="sidebar-header">
                        <h2>Sections</h2>
                        <p>{sections.length} total</p>
                      </div>
                      <div className="section-list">
                        {sections.map((section) => (
                          <div key={section.id}>
                            <button
                              className={`section-item ${selectedSection?.id === section.id ? 'active' : ''}`}
                              onClick={() => setSelectedSection(section)}
                            >
                              <span className="section-icon">
                                <File size={16} />
                              </span>
                              <div className="section-content">
                                <span className="section-title">{section.title}</span>
                                <div className="section-actions">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleVisibility(section.id);
                                    }}
                                    title={section.visible ? "Hide" : "Show"}
                                  >
                                    {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveSection(section.id, 'up');
                                    }}
                                    title="Move Up"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveSection(section.id, 'down');
                                    }}
                                    title="Move Down"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSection(section.id);
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </button>
                          </div>
                        ))}
                        <button className="add-section-btn">
                          <Plus size={16} />
                          <span>Add Section</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="content-wrapper" ref={containerRef}>
                  {splitView ? (
                    <>
                      <div className="content-panel" style={{ width: `${splitPosition}%` }}>
                        <div className="panel-content">
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
                              onClick={() => addNewSubject(selectedSection?.id)}
                              className="add-btn"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Plus size={16} />
                              ADD SUBSECTION
                            </motion.button>
                          </div>

                          <div className="subjects-list">
                            {selectedSection?.subjects?.map((subject) => {
                              const isExpanded = isSubjectExpanded(subject.id);

                              return (
                                <motion.div
                                  key={subject.id}
                                  className="subject-card"
                                  layout
                                >
                                  <div className="subject-header">
                                    <motion.button
                                      onClick={() => toggleSubject(subject.id)}
                                      className="expand-btn"
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      <motion.div
                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                        transition={{ duration: 0.2 }}
                                      >
                                        <ChevronRight size={16} />
                                      </motion.div>
                                    </motion.button>

                                    <input
                                      type="text"
                                      value={subject.title}
                                      onChange={(e) => updateSubjectTitle(selectedSection.id, subject.id, e.target.value)}
                                      className="subject-title-input"
                                    />

                                    <motion.button
                                      onClick={() => deleteSubject(selectedSection.id, subject.id)}
                                      className="delete-btn"
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                    >
                                      <Trash2 size={16} />
                                    </motion.button>
                                  </div>

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
                                          placeholder="Add your content here..."
                                        />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div 
                        className="resize-handle"
                        onMouseDown={handleMouseDown}
                      >
                        <GripVertical size={20} />
                      </div>

                      <div className="content-panel preview-panel" style={{ width: `${100 - splitPosition}%` }}>
                        <div className="panel-content">
                          <div className="preview-header-inline">
                            <h3>Live Preview</h3>
                            <span>{sections.filter(s => s.visible).length} visible sections</span>
                          </div>
                          <div className="preview-box">
                            <pre>{reconstructPrompt()}</pre>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="content-panel" style={{ width: '100%' }}>
                      <div className="panel-content">
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
                            onChange={(e) => updateSectionTitle(selectedSection?.id, e.target.value)}
                            className="section-title-input"
                            placeholder="Section Title"
                          />
                          <motion.button
                            onClick={() => addNewSubject(selectedSection?.id)}
                            className="add-btn"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Plus size={16} />
                            ADD SUBSECTION
                          </motion.button>
                        </div>

                        <div className="subjects-list">
                          {selectedSection?.subjects?.map((subject) => {
                            const isExpanded = isSubjectExpanded(subject.id);

                            return (
                              <motion.div key={subject.id} className="subject-card" layout>
                                <div className="subject-header">
                                  <motion.button
                                    onClick={() => toggleSubject(subject.id)}
                                    className="expand-btn"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                      <ChevronRight size={16} />
                                    </motion.div>
                                  </motion.button>

                                  <input
                                    type="text"
                                    value={subject.title}
                                    onChange={(e) => updateSubjectTitle(selectedSection?.id, subject.id, e.target.value)}
                                    className="subject-title-input"
                                  />

                                  <motion.button
                                    onClick={() => deleteSubject(selectedSection?.id, subject.id)}
                                    className="delete-btn"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <Trash2 size={16} />
                                  </motion.button>
                                </div>

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
                                        onChange={(e) => updateSubjectContent(selectedSection?.id, subject.id, e.target.value)}
                                        className="subject-textarea"
                                        placeholder="Add your content here..."
                                      />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Analytics View
              <>
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.div
                      className="sidebar"
                      style={{ width: '240px' }}
                      initial={{ x: -240 }}
                      animate={{ x: 0 }}
                      exit={{ x: -240 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="sidebar-header">
                        <h2>Analytics</h2>
                        <p>{stats ? `${stats.total} components` : 'No data'}</p>
                      </div>
                      
                      <div style={{ padding: '12px' }}>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept=".jsx"
                          multiple
                          style={{ display: 'none' }}
                        />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isProcessing}
                          className="parse-button"
                          style={{ width: '100%', padding: '12px', fontSize: '11px' }}
                        >
                          {isProcessing ? (
                            'Processing...'
                          ) : (
                            <>
                              <Upload size={14} style={{ marginRight: '6px', display: 'inline' }} />
                              Upload Files
                            </>
                          )}
                        </button>
                      </div>

                      <div className="section-list">
                        {[
                          { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
                          { id: 'triggers', label: 'Prompt Sections', icon: <Target size={16} /> },
                          { id: 'decisions', label: 'Design Patterns', icon: <Palette size={16} /> },
                          { id: 'timeline', label: 'Timeline', icon: <TrendingUp size={16} /> },
                          { id: 'types', label: 'Component Types', icon: <Layers size={16} /> }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            className={`section-item ${analyticsTab === tab.id ? 'active' : ''}`}
                            onClick={() => setAnalyticsTab(tab.id)}
                          >
                            <span className="section-icon">{tab.icon}</span>
                            <div className="section-content">
                              <span className="section-title">{tab.label}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="content-panel" style={{ width: '100%' }}>
                  <div className="panel-content">
                    {renderAnalyticsContent()}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;