import React, { useState, useEffect, useRef } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  ChevronRight,
  ChevronLeft,
  Flag,
  Target,
  ClipboardCheck,
  BookOpen,
} from "lucide-react";
import { fetchData } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";

interface MilestoneTemplate {
  milestoneTemplateID: number;
  milestoneTemplateCode: string;
  name: string;
  description: string;
  ordinal: number;
  deadline: string | null;
}

// --- Custom Modern DatePicker Component with Scroll Time ---
interface CustomPickerProps {
  value: string | null;
  onChange: (newValue: string) => void;
  label: string;
}

const CustomDatePicker: React.FC<CustomPickerProps> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTimeMode, setIsTimeMode] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(value || new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTimeMode(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedDate = value ? new Date(value) : new Date();
  
  const handleSelectDay = (day: number) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(viewDate.getFullYear());
    newDate.setMonth(viewDate.getMonth());
    newDate.setDate(day);
    onChange(newDate.toISOString());
    setIsTimeMode(true);
  };

  const handleTimeSelect = (type: 'h' | 'm', val: number) => {
    const newDate = new Date(selectedDate);
    if (type === 'h') newDate.setHours(val);
    else newDate.setMinutes(val);
    onChange(newDate.toISOString());
  };

  const formatDisplay = (val: string | null) => {
    if (!val) return "Chọn thời gian...";
    const d = new Date(val);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} - ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="ms-custom-picker" ref={containerRef}>
      <label>{label}</label>
      <div className="ms-picker-trigger" onClick={() => setIsOpen(!isOpen)}>
        <CalendarIcon size={18} />
        <span>{formatDisplay(value)}</span>
        <ChevronRight size={16} className={`ms-picker-arrow ${isOpen ? 'is-open' : ''}`} />
      </div>

      {isOpen && (
        <div className="ms-picker-dropdown">
          <div className="ms-picker-tabs">
            <button className={!isTimeMode ? 'is-active' : ''} onClick={() => setIsTimeMode(false)}>
              <CalendarIcon size={14} /> Ngày
            </button>
            <button className={isTimeMode ? 'is-active' : ''} onClick={() => setIsTimeMode(true)}>
              <Clock size={14} /> Giờ
            </button>
          </div>

          {!isTimeMode ? (
            <div className="ms-calendar-view">
              <div className="ms-picker-header">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}><ChevronLeft size={16}/></button>
                <div className="ms-picker-title">Tháng {viewDate.getMonth() + 1}, {viewDate.getFullYear()}</div>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}><ChevronRight size={16}/></button>
              </div>
              <div className="ms-picker-weekdays">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => <span key={d}>{d}</span>)}
              </div>
              <div className="ms-picker-grid">
                {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="ms-picker-day is-empty"></div>
                ))}
                {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                  const d = i + 1;
                  const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
                  return (
                    <div key={d} className={`ms-picker-day ${isSelected ? 'is-selected' : ''}`} onClick={() => handleSelectDay(d)}>{d}</div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="ms-time-view">
              <div className="ms-time-columns">
                <div className="ms-time-col">
                  <span>Giờ</span>
                  <div className="ms-time-scroll">
                    {hours.map(h => (
                      <div 
                        key={h} 
                        className={`ms-time-option ${selectedDate.getHours() === h ? 'is-active' : ''}`}
                        onClick={() => handleTimeSelect('h', h)}
                      >
                        {h.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ms-time-col">
                  <span>Phút</span>
                  <div className="ms-time-scroll">
                    {minutes.map(m => (
                      <div 
                        key={m} 
                        className={`ms-time-option ${selectedDate.getMinutes() === m ? 'is-active' : ''}`}
                        onClick={() => handleTimeSelect('m', m)}
                      >
                        {m.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="ms-picker-footer">
            <button className="ms-btn-confirm" onClick={() => setIsOpen(false)}>Xác nhận</button>
          </div>
        </div>
      )}
    </div>
  );
};

const MilestoneSettings: React.FC = () => {
  const [milestones, setMilestones] = useState<MilestoneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadMilestones = async () => {
    setLoading(true);
    try {
      const res = await fetchData<ApiResponse<MilestoneTemplate[]>>("/MilestoneTemplates/get-list");
      if (res.success && res.data) {
        setMilestones([...res.data].sort((a, b) => a.ordinal - b.ordinal));
      } else {
        setError("Không thể tải danh sách tiến độ.");
      }
    } catch (err) {
      setError("Đã xảy ra lỗi khi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMilestones(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      for (let i = 0; i < milestones.length - 1; i++) {
        const current = new Date(milestones[i].deadline!);
        const next = new Date(milestones[i+1].deadline!);
        if (current >= next) {
          setError(`Hạn nộp mốc ${i + 1} phải trước mốc ${i + 2}.`);
          setSaving(false); return;
        }
      }
      const promises = milestones.map(m => 
        fetchData<ApiResponse<any>>(`/MilestoneTemplates/update/${m.milestoneTemplateID}`, {
          method: "PUT",
          body: { name: m.name, description: m.description, deadline: m.deadline, ordinal: m.ordinal }
        })
      );
      const results = await Promise.all(promises);
      if (results.every(r => r.success)) {
        setSuccess("Cập nhật lộ trình thành công!");
        loadMilestones();
      } else setError("Cập nhật thất bại.");
    } catch (err) { setError("Lỗi hệ thống."); } finally { setSaving(false); }
  };

  if (loading) return <div className="ms-loading-container"><div className="ms-loader"></div></div>;

  return (
    <div className="ms-page">
      <style>{msStyles}</style>
      <div className="ms-container">
        {/* Sticky Header Wrapper */}
        <div className="ms-sticky-header">
          <div className="ms-header">
            <div className="ms-header-info">
              <div className="ms-header-icon-box"><CalendarIcon size={28} /></div>
              <div>
                <h1>Thiết lập lộ trình đồ án</h1>
                <p>Quản lý các giai đoạn quan trọng và thời hạn nộp bài của sinh viên.</p>
              </div>
            </div>
            <button className="ms-btn-save" disabled={saving} onClick={handleSave}>
              {saving ? <div className="ms-spinner-small"></div> : <Save size={18} />}
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </div>

        {error && <div className="ms-notification ms-notification--error"><AlertCircle size={20} /><span>{error}</span></div>}
        {success && <div className="ms-notification ms-notification--success"><CheckCircle2 size={20} /><span>{success}</span></div>}

        <div className="ms-layout">
          <div className="ms-sidebar">
            <div className="ms-sidebar-card">
              <h3>Tóm tắt lộ trình</h3>
              <div className="ms-mini-roadmap">
                {milestones.map((m, idx) => (
                  <React.Fragment key={m.milestoneTemplateID}>
                    <div className="ms-mini-step">
                      <div className={`ms-mini-dot ${m.ordinal === 4 ? 'is-final' : ''}`}>{m.ordinal}</div>
                      <div className="ms-mini-info">
                        <span className="ms-mini-label">{m.name}</span>
                        <span className="ms-mini-date">{m.deadline ? new Date(m.deadline).toLocaleDateString('vi-VN') : '---'}</span>
                      </div>
                    </div>
                    {idx < milestones.length - 1 && <div className="ms-mini-line"></div>}
                  </React.Fragment>
                ))}
              </div>
              <div className="ms-sidebar-footer">
                <Info size={14} />
                <span>Quy trình cố định 4 giai đoạn</span>
              </div>
            </div>
          </div>

          <div className="ms-main-content">
            <div className="ms-timeline">
              {milestones.map((m, idx) => (
                <div key={m.milestoneTemplateID} className={`ms-timeline-item ${m.ordinal === 4 ? 'is-last' : ''}`}>
                  <div className="ms-timeline-left">
                    <div className={`ms-milestone-circle ${m.ordinal === 4 ? 'is-final' : ''}`}>
                      {m.ordinal === 1 ? <Target size={22}/> : m.ordinal === 4 ? <Flag size={22}/> : <BookOpen size={22}/>}
                    </div>
                    {idx < milestones.length - 1 && <div className="ms-timeline-connector"></div>}
                  </div>
                  <div className="ms-timeline-card">
                    <div className="ms-card-header">
                      <span className="ms-card-number">Giai đoạn {m.ordinal}</span>
                      <div className="ms-code-tag">{m.milestoneTemplateCode}</div>
                    </div>
                    <div className="ms-form-grid">
                      <div className="ms-form-group">
                        <label>Tên giai đoạn</label>
                        <input type="text" value={m.name} onChange={(e) => setMilestones(prev => prev.map(x => x.milestoneTemplateID === m.milestoneTemplateID ? {...x, name: e.target.value} : x))} />
                      </div>
                      <div className="ms-form-group">
                        <label>Mô tả yêu cầu</label>
                        <textarea rows={2} value={m.description || ""} onChange={(e) => setMilestones(prev => prev.map(x => x.milestoneTemplateID === m.milestoneTemplateID ? {...x, description: e.target.value} : x))} />
                      </div>
                      <div className="ms-form-group">
                        <CustomDatePicker label="Hạn nộp bài cuối cùng" value={m.deadline} onChange={(val) => setMilestones(prev => prev.map(x => x.milestoneTemplateID === m.milestoneTemplateID ? {...x, deadline: val} : x))} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const msStyles = `
  .ms-page { min-height: 100vh; background: #f8fafc; padding: 40px 0; font-family: "Be Vietnam Pro", sans-serif; }
  .ms-container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }

  /* Header Overlap Fix */
  .ms-sticky-header {
    position: sticky;
    top: -10px; /* Offset slightly to sync with scroll */
    z-index: 40; /* Lower than app top nav, higher than cards */
    background: #f8fafc;
    padding: 10px 0 20px 0;
    margin-top: -10px;
  }
  
  .ms-header { 
    display: flex; justify-content: space-between; align-items: center; 
    background: white; padding: 24px 30px; border-radius: 24px; 
    box-shadow: 0 10px 25px rgba(0,0,0,0.03); 
    border: 1px solid rgba(226, 232, 240, 0.8);
  }
  .ms-header-info { display: flex; align-items: center; gap: 20px; }
  .ms-header-icon-box { 
    background: #003D82; color: white; width: 56px; height: 56px; 
    display: flex; align-items: center; justify-content: center; border-radius: 16px; 
    box-shadow: 0 8px 16px rgba(0, 61, 130, 0.2);
  }
  .ms-header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
  .ms-header p { margin: 4px 0 0; color: #64748b; font-size: 14px; }
  .ms-btn-save { 
    background: #003D82; color: white; border: none; padding: 12px 28px; 
    border-radius: 14px; font-weight: 700; cursor: pointer; 
    display: flex; align-items: center; gap: 10px; transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(0, 61, 130, 0.2);
  }
  .ms-btn-save:hover:not(:disabled) { background: #002d61; transform: translateY(-2px); }

  /* Custom Picker UI */
  .ms-custom-picker { position: relative; }
  .ms-picker-trigger { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: white; border: 2px solid #f1f5f9; border-radius: 14px; cursor: pointer; font-weight: 600; transition: border-color 0.2s; }
  .ms-picker-trigger:hover { border-color: #3b82f6; }
  .ms-picker-trigger span { flex: 1; color: #1e293b; }
  .ms-picker-dropdown { position: absolute; bottom: calc(100% + 8px); left: 0; width: 320px; background: white; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; z-index: 50; padding: 20px; animation: slideUp 0.2s ease-out; }
  
  .ms-picker-tabs { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; margin-bottom: 16px; }
  .ms-picker-tabs button { flex: 1; border: none; background: none; padding: 8px; font-size: 12px; font-weight: 700; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748b; }
  .ms-picker-tabs button.is-active { background: white; color: #003D82; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  
  .ms-picker-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .ms-picker-header button { background: none; border: none; cursor: pointer; color: #64748b; padding: 4px; border-radius: 8px; transition: background 0.2s; }
  .ms-picker-header button:hover { background: #f1f5f9; color: #1e293b; }
  .ms-picker-title { font-weight: 800; color: #0f172a; font-size: 15px; }

  .ms-picker-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .ms-picker-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 10px; color: #475569; }
  .ms-picker-day:hover { background: #eff6ff; color: #3b82f6; }
  .ms-picker-day.is-selected { background: #003D82; color: white; }
  .ms-picker-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); font-size: 11px; font-weight: 800; color: #94a3b8; text-align: center; margin-bottom: 10px; }

  .ms-time-view { height: 180px; }
  .ms-time-columns { display: flex; gap: 12px; height: 100%; }
  .ms-time-col { flex: 1; display: flex; flex-direction: column; }
  .ms-time-col span { font-size: 11px; font-weight: 800; color: #94a3b8; margin-bottom: 10px; text-align: center; }
  .ms-time-scroll { flex: 1; overflow-y: auto; background: #f8fafc; border-radius: 12px; scroll-behavior: smooth; border: 1px solid #f1f5f9; }
  .ms-time-option { padding: 10px; text-align: center; font-size: 14px; font-weight: 700; color: #475569; cursor: pointer; transition: all 0.2s; }
  .ms-time-option:hover { background: #f1f5f9; color: #003D82; }
  .ms-time-option.is-active { background: #003D82; color: white; }

  .ms-picker-footer { margin-top: 16px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
  .ms-quick-actions { display: flex; gap: 10px; margin-bottom: 16px; }
  .ms-quick-actions button { flex: 1; font-size: 12px; font-weight: 700; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 8px; border-radius: 10px; cursor: pointer; transition: all 0.2s; }
  .ms-quick-actions button:hover { background: #e2e8f0; color: #003D82; }
  .ms-btn-confirm { width: 100%; background: #003D82; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 61, 130, 0.2); }

  /* Sidebar Card Restored */
  .ms-layout { display: grid; grid-template-columns: 300px 1fr; gap: 30px; }
  .ms-sidebar-card { 
    background: white; padding: 24px; border-radius: 24px; 
    box-shadow: 0 10px 25px rgba(0,0,0,0.02); border: 1px solid #e2e8f0; 
    position: sticky; top: 140px; 
  }
  .ms-sidebar-card h3 { margin: 0 0 24px; font-size: 18px; font-weight: 800; color: #0f172a; }
  .ms-mini-roadmap { display: flex; flex-direction: column; }
  .ms-mini-step { display: flex; gap: 16px; align-items: center; padding: 12px 0; }
  .ms-mini-dot { 
    width: 32px; height: 32px; background: #eff6ff; color: #3b82f6; 
    border-radius: 10px; display: flex; align-items: center; justify-content: center; 
    font-weight: 800; font-size: 14px; flex-shrink: 0;
  }
  .ms-mini-dot.is-final { background: #fff7ed; color: #f97316; }
  .ms-mini-info { display: flex; flex-direction: column; min-width: 0; }
  .ms-mini-label { font-size: 14px; font-weight: 700; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ms-mini-date { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  .ms-mini-line { width: 2px; height: 20px; background: #e2e8f0; margin-left: 15px; }
  .ms-sidebar-footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 12px; font-weight: 600; }

  /* Timeline Editor */
  .ms-timeline-item { display: flex; gap: 30px; }
  .ms-timeline-left { display: flex; flex-direction: column; align-items: center; width: 56px; }
  .ms-milestone-circle { 
    width: 56px; height: 56px; background: white; border: 3px solid #003D82; 
    color: #003D82; border-radius: 50%; display: flex; align-items: center; 
    justify-content: center; z-index: 2; box-shadow: 0 0 0 8px #f0f7ff; 
  }
  .ms-milestone-circle.is-final { border-color: #F37021; color: #F37021; box-shadow: 0 0 0 8px #fff7ed; }
  .ms-timeline-connector { width: 4px; flex: 1; background: #e2e8f0; margin: 10px 0; border-radius: 10px; }
  .ms-timeline-card { 
    flex: 1; background: white; border-radius: 24px; padding: 24px; 
    margin-bottom: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #e2e8f0; 
  }
  .ms-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .ms-card-number { font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .ms-code-tag { font-family: monospace; font-size: 12px; color: #94a3b8; background: #f8fafc; padding: 4px 10px; border-radius: 8px; border: 1px solid #f1f5f9; }
  
  .ms-form-grid { display: grid; gap: 20px; }
  .ms-form-group label { display: block; font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 8px; }
  .ms-form-group input, .ms-form-group textarea { width: 100%; padding: 12px 16px; border: 2px solid #f1f5f9; border-radius: 14px; font-size: 15px; color: #1e293b; background: #f8fafc; transition: all 0.2s; }
  .ms-form-group input:focus, .ms-form-group textarea:focus { outline: none; border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
  
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .ms-loader { width: 48px; height: 48px; border: 5px solid #eff6ff; border-top: 5px solid #003D82; border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .ms-loading-container { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
  .ms-spinner-small { width: 18px; height: 18px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; }
`;

export default MilestoneSettings;
