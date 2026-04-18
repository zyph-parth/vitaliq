'use client'
// app/nutrients/page.tsx — Nutrient Explorer (from Vitro, styled as VitalIQ)

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui'
import { foodDatabase, type Food, type FoodCategory } from '@/lib/foods'
import { clsx } from 'clsx'

const CATEGORIES: { value: FoodCategory|'all'; label: string }[] = [
  { value:'all', label:'All' },
  { value:'grains', label:'Grains' },
  { value:'protein', label:'Protein' },
  { value:'dairy', label:'Dairy' },
  { value:'fruits', label:'Fruits' },
  { value:'veggies', label:'Vegetables' },
  { value:'indian', label:'Indian' },
  { value:'snacks', label:'Snacks' },
]

export default function NutrientsPage() {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<FoodCategory|'all'>('all')
  const [selected, setSelected] = useState<Food|null>(null)

  const filtered = foodDatabase.filter(f => {
    const matchCat = cat === 'all' || f.category === cat
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <AppShell>
      {/* Header */}
      <div className="px-4 pt-3 pb-3">
        <div className="text-[13px] font-medium text-[#8A8A85]">Nutrition</div>
        <h1 className="font-display text-[26px] font-bold tracking-tight mt-0.5">Nutrient Explorer 🥦</h1>
        <p className="text-[13px] text-[#8A8A85] mt-1">Quick nutritional facts for everyday Indian & global foods.</p>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px]">🔍</span>
          <input
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#E8E8E3] bg-white text-[14px] outline-none focus:border-[#2D6A4F] transition-colors"
            placeholder="Search food…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 mb-4 pb-1">
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setCat(c.value)}
            className={clsx(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-all',
              cat === c.value ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' : 'border-[#E8E8E3] bg-white text-[#8A8A85] hover:border-[#1A1A1A]'
            )}
          >{c.label}</button>
        ))}
      </div>

      {/* Food grid */}
      <div className="food-grid px-4 pb-6">
        {filtered.map(food => (
          <button key={food.id} onClick={() => setSelected(food)}
            className="surface-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]">
            <div className="text-[28px] mb-2">{food.emoji}</div>
            <div className="text-[13px] font-semibold text-[#1A1A1A] mb-0.5">{food.name}</div>
            <div className="text-[12px] font-semibold text-[#2D6A4F]">{food.cal} kcal</div>
            <div className="text-[10px] text-[#8A8A85]">{food.per}</div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-[#8A8A85] text-[14px]">No foods found.</div>
        )}
      </div>

      {/* Detail bottom sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
          style={{ background: 'rgba(26,26,24,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="w-full max-w-[480px] lg:max-w-lg rounded-t-3xl lg:rounded-3xl px-6 pt-5 pb-10 animate-scale-in"
            style={{ background: 'var(--cream)' }}>
            <div className="w-9 h-1 rounded-full mx-auto mb-5 lg:hidden" style={{ background: 'var(--border)' }} />
            <div className="flex items-start gap-4 mb-4">
              <span className="text-[48px]">{selected.emoji}</span>
              <div>
                <h2 className="font-display text-[20px] font-semibold">{selected.name}</h2>
                <p className="text-[12px] text-[#8A8A85] mt-0.5">{selected.per}</p>
              </div>
            </div>
            <div className="font-display text-[32px] font-bold mb-4" style={{ color: '#2D6A4F' }}>
              {selected.cal} <span className="text-[14px] font-normal text-[#8A8A85]">kcal</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {[
                { label:'Protein', value:`${selected.protein}g` },
                { label:'Carbs', value:`${selected.carbs}g` },
                { label:'Fat', value:`${selected.fat}g` },
                { label:'Fibre', value:`${selected.fiber}g` },
              ].map(n => (
                <div key={n.label} className="rounded-xl p-3" style={{ background: '#F7F6F3' }}>
                  <div className="font-display text-[16px] font-semibold">{n.value}</div>
                  <div className="text-[11px] text-[#8A8A85] mt-0.5">{n.label}</div>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl mb-4 text-[13px] leading-relaxed text-[#3D3D3A]"
              style={{ background: '#D8F3DC', border: '1px solid #95D5B2' }}>
              <strong style={{ color: '#2D6A4F' }}>AI insight: </strong>{selected.insight}
            </div>
            <button onClick={() => setSelected(null)}
              className="w-full py-3 rounded-2xl text-[13px] font-semibold text-[#8A8A85] transition-all"
              style={{ background: '#F1F1EC' }}>Close</button>
          </div>
        </div>
      )}
    </AppShell>
  )
}
