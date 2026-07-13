import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface TimeDialPickerProps {
  onTimeChange: (timeString: string) => void;
  initialValue?: string;
}

export default function TimeDialPicker({ onTimeChange, initialValue }: TimeDialPickerProps) {
  const days = ['今天', '明天', '后天'];
  
  // Generate hours: 00 to 23
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  
  // Generate minutes: 00 to 59
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Get current date time to set smart defaults
  const now = new Date();
  const currentHourStr = now.getHours().toString().padStart(2, '0');
  const currentMinStr = Math.min(59, Math.ceil(now.getMinutes() / 5) * 5).toString().padStart(2, '0');

  // Initial states
  const [selectedDay, setSelectedDay] = useState('今天');
  const [selectedHour, setSelectedHour] = useState(currentHourStr);
  const [selectedMinute, setSelectedMinute] = useState(currentMinStr);

  // Refs for scroll elements to center them
  const dayContainerRef = useRef<HTMLDivElement>(null);
  const hourContainerRef = useRef<HTMLDivElement>(null);
  const minuteContainerRef = useRef<HTMLDivElement>(null);

  // Emit change when selections update
  useEffect(() => {
    const formattedTime = `${selectedDay} ${selectedHour}:${selectedMinute}`;
    onTimeChange(formattedTime);
  }, [selectedDay, selectedHour, selectedMinute]);

  // Unified click/scroll transition handler to center items
  const handleSelectDay = (day: string) => {
    setSelectedDay(day);
  };

  const handleSelectHour = (hour: string) => {
    setSelectedHour(hour);
  };

  const handleSelectMinute = (minute: string) => {
    setSelectedMinute(minute);
  };

  // Helper render function for columns with drum wheel perspective
  const renderDrumColumn = (
    list: string[], 
    selectedVal: string, 
    onSelect: (val: string) => void,
    containerRef: React.RefObject<HTMLDivElement | null>
  ) => {
    const selectedIdx = list.indexOf(selectedVal);

    // Click wheel buttons to cycle up/down easily
    const cycleItem = (direction: 'up' | 'down') => {
      let nextIdx = direction === 'up' ? selectedIdx - 1 : selectedIdx + 1;
      if (nextIdx < 0) nextIdx = list.length - 1;
      if (nextIdx >= list.length) nextIdx = 0;
      onSelect(list[nextIdx]);
    };

    return (
      <div className="flex flex-col items-center bg-[#FDFCFB] border border-[#EBE5DF] p-2 relative flex-1 select-none">
        {/* Top Scroll button */}
        <button 
          onClick={() => cycleItem('up')}
          className="p-1 hover:bg-[#F5F2EF] text-[#C5A880] transition-colors rounded-none mb-1 cursor-pointer"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Scroll Drum Window */}
        <div 
          ref={containerRef}
          className="relative h-32 w-full overflow-hidden flex flex-col items-center justify-center py-2"
          onWheel={(e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
              cycleItem('up');
            } else {
              cycleItem('down');
            }
          }}
        >
          {/* Active selection highlighting center track bar */}
          <div className="absolute inset-y-10 inset-x-0 bg-[#F5F2EF] border-y border-[#C5A880]/30 -z-10 pointer-events-none"></div>

          {/* Visible Items with Perspective Scale */}
          <div className="space-y-0.5 w-full flex flex-col items-center">
            {list.map((item, idx) => {
              const distance = idx - selectedIdx;
              const absDistance = Math.abs(distance);
              
              // Only display items within view range
              if (absDistance > 2) return null;

              // Perspective styling
              let styleClass = "";
              if (distance === 0) {
                // Active Center
                styleClass = "text-base font-bold text-[#1A1A1A] scale-110 opacity-100 z-10 py-1";
              } else if (absDistance === 1) {
                // Adjacent
                styleClass = "text-xs text-slate-400 scale-95 opacity-60 cursor-pointer hover:text-[#1A1A1A] py-1";
              } else {
                // Outlying
                styleClass = "text-[10px] text-slate-300 scale-85 opacity-30 cursor-pointer hover:text-slate-400 py-0.5";
              }

              return (
                <div
                  key={item}
                  onClick={() => onSelect(item)}
                  className={`w-full text-center transition-all duration-200 font-mono ${styleClass}`}
                >
                  {item === '今天' || item === '明天' || item === '后天' ? (
                    <span className="font-serif font-semibold">{item}</span>
                  ) : (
                    <span>{item}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Scroll button */}
        <button 
          onClick={() => cycleItem('down')}
          className="p-1 hover:bg-[#F5F2EF] text-[#C5A880] transition-colors rounded-none mt-1 cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-[#FDFCFB] border border-[#EBE5DF] p-4 rounded-none">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-[#006241]" />
        <span className="text-xs font-sans font-bold text-[#1A1A1A]">预约取餐时间</span>
        <span className="text-[9px] font-sans text-[#C5A880] uppercase tracking-wider ml-auto bg-[#F5F2EF] px-2 py-0.5 border border-[#EBE5DF]">
          转轮时间选择器
        </span>
      </div>

      <p className="text-[10px] text-slate-500 mb-4 font-sans">
        请滚动或点击上下箭头选择您的预约取餐时段，我们会为您准时备好。
      </p>

      {/* 3-Column Drum Picker */}
      <div className="flex gap-2">
        {renderDrumColumn(days, selectedDay, handleSelectDay, dayContainerRef)}
        {renderDrumColumn(hours, selectedHour, handleSelectHour, hourContainerRef)}
        {renderDrumColumn(minutes, selectedMinute, handleSelectMinute, minuteContainerRef)}
      </div>

      {/* Selected Time Display Output */}
      <div className="mt-4 p-3 bg-[#F5F2EF] border border-[#EBE5DF] rounded-none text-center">
        <div className="text-[9px] uppercase tracking-wider text-slate-400 font-sans">已选定的预计取餐时间</div>
        <div className="text-sm font-sans font-bold text-[#1A1A1A] mt-1 flex items-center justify-center gap-2">
          <span>📅</span> 
          <span className="text-[#006241]">{selectedDay}</span>
          <span className="font-mono text-[#C5A880] text-base">{selectedHour}:{selectedMinute}</span>
        </div>
      </div>
    </div>
  );
}
