'use client';

import { memo, useMemo, useState } from 'react';
import { Plane, Ship, Satellite, ChevronRight, Navigation } from 'lucide-react';
import { type Contact, type ContactType, filterByType, formatDistance, formatBearing } from '@/lib/contacts-engine';

/**
 * ContactsRoster — scrollable list of entities within 250 km of the
 * tracked target, sorted by distance.
 */

interface ContactsRosterProps {
  contacts: Contact[];
  /** Currently selected contact ID. */
  selectedId: string | null;
  /** Called when the user clicks a contact. */
  onSelect: (contact: Contact) => void;
  /** Direct chase action into Cockpit mode. */
  onTrackCockpit?: (contact: Contact) => void;
  /** Whether the panel is visible. */
  visible: boolean;
  onClose: () => void;
}

const TYPE_ICON: Record<ContactType, typeof Plane> = {
  flight: Plane,
  ship: Ship,
  satellite: Satellite,
};

const TYPE_COLOR: Record<ContactType, string> = {
  flight: 'var(--cyan-primary)',
  ship: 'var(--alert-blue)',
  satellite: 'var(--alert-orange)',
};

function ContactRow({
  contact,
  selected,
  onSelect,
  onTrackCockpit,
}: {
  contact: Contact;
  selected: boolean;
  onSelect: () => void;
  onTrackCockpit?: () => void;
}) {
  const Icon = TYPE_ICON[contact.type];
  const color = TYPE_COLOR[contact.type];

  return (
    <div
      onClick={onSelect}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-150 cursor-pointer ${
        selected
          ? 'bg-[var(--gold-primary)]/10 border-l-2 border-[var(--gold-primary)]'
          : 'hover:bg-white/5 border-l-2 border-transparent'
      }`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono font-bold text-[var(--text-primary)] truncate tracking-wider">
          {contact.label}
        </div>
        <div className="text-[8px] font-mono text-[var(--text-muted)] tabular-nums">
          {formatDistance(contact.distanceKm)} · {formatBearing(contact.bearingDeg)}
          {contact.alt > 0 && ` · ${Math.round(contact.alt * 3.28084).toLocaleString()} ft`}
        </div>
      </div>
      {contact.type === 'flight' && onTrackCockpit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTrackCockpit();
          }}
          className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/40 hover:bg-[var(--gold-primary)]/40 transition-colors pointer-events-auto shrink-0"
          title="3인칭 콕핏 추적 모드 진입"
        >
          CHASE
        </button>
      )}
      <ChevronRight className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
    </div>
  );
}

function ContactsRosterInner({
  contacts,
  selectedId,
  onSelect,
  onTrackCockpit,
  visible,
  onClose,
}: ContactsRosterProps) {
  const [typeFilter, setTypeFilter] = useState<ContactType | 'all'>('all');

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return contacts;
    return filterByType(contacts, typeFilter);
  }, [contacts, typeFilter]);

  const typeCounts = useMemo(() => ({
    flight: contacts.filter(c => c.type === 'flight').length,
    ship: contacts.filter(c => c.type === 'ship').length,
    satellite: contacts.filter(c => c.type === 'satellite').length,
  }), [contacts]);

  if (!visible) return null;

  return (
    <div className="absolute right-3 sm:right-12 top-16 z-[400] w-72 max-w-[calc(100vw-24px)] max-h-[60vh] glass-panel overflow-hidden pointer-events-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          <span className="text-[10px] font-mono font-bold text-[var(--text-heading)] tracking-[0.2em]">
            CONTACTS
          </span>
          <span className="text-[9px] font-mono text-[var(--alert-green)] tabular-nums">
            {contacts.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[10px] font-mono"
        >
          ✕
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-0.5 px-2 py-1.5 border-b border-white/5">
        {(['all', 'flight', 'ship', 'satellite'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`px-2 py-0.5 rounded text-[8px] font-mono tracking-wider transition-colors ${
              typeFilter === t
                ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] border border-[var(--gold-primary)]/30'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t === 'all' ? `ALL ${contacts.length}` : `${t.slice(0, 3).toUpperCase()} ${typeCounts[t]}`}
          </button>
        ))}
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[9px] font-mono text-[var(--text-muted)]">
            NO CONTACTS IN RANGE
          </div>
        ) : (
          filtered.map(c => (
            <ContactRow
              key={`${c.type}-${c.id}`}
              contact={c}
              selected={selectedId === c.id}
              onSelect={() => onSelect(c)}
              onTrackCockpit={onTrackCockpit ? () => onTrackCockpit(c) : undefined}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-white/5 text-[8px] font-mono text-[var(--text-muted)] text-center tracking-wider">
        250 KM RADIUS · DISTANCE SORTED
      </div>
    </div>
  );
}

export default memo(ContactsRosterInner);
