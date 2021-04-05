import React, { useState, useEffect, useMemo, useCallback } from 'react'
import classNames from 'classnames'
import format from 'date-fns/format'
import { BsArrowRightShort } from 'react-icons/bs'

import Chloropleth from './Chloropleth'
import LocalIncidence from './LocalIncidence'
import Card from './Card'
import Select from './Select'
import { Heading } from './Typography'
import { PillButton } from './Button'
import Spinner from './Spinner'
import FadeTransition from './FadeTransition'
import DateFilter from './DateFilter'
import LocationFilter from './LocationFilter'
import FilterSection from './FilterSection'
import StickyActionButton from './StickyActionButton'

import { loadData } from '../utils/loadData'
import useMobile from '../hooks/useMobile'
import useLADs from '../hooks/useLADs'
import useLineages from '../hooks/useLineages'
import { useTiles, useLALookupTable } from '../hooks/useTiles'

const data = loadData()

const Covid19 = ({ lineColor = 'blueGray' }) => {
  const tiles = useTiles()
  const LALookupTable = useLALookupTable(tiles)

  const unique_lineages = data.lineages

  const [playing, setPlaying] = useState(false)
  const [date, setDate] = useState(data.initialDate)

  const [ladState, ladActions] = useLADs()
  const [lineageState, lineageActions, results] = useLineages()

  const bumpDate = () => {
    let cur_index = results.dates.indexOf(date)
    if (results.dates[cur_index + 1] === undefined) {
      cur_index = -1
    }
    const set_to = results.dates[cur_index + 1]
    setDate(set_to)
  }

  useEffect(() => {
    if (playing) {
      const timeout = setTimeout(bumpDate, 100)
      return () => clearTimeout(timeout)
    }
  }, [playing, date])

  let unique_parameters = ['lambda', 'p', 'R']

  const handleOnClick = (lad) => {
    ladActions.load(lad)
  }

  const handleDateSlider = (e) => {
    const { value } = e.target
    const set_to = results.dates[value]
    setDate(set_to)
  }

  unique_parameters = [['lambda', 'Incidence'], ['p', 'Proportion'], ['R', 'R']]
  if (lineageState.lineage === 'total') {
    unique_parameters = unique_parameters[0]
  }
  const parameter_options = unique_parameters.map((x) => <option key={x[0]} value={x[0]}>{x[1]}</option>)

  const [view, setView] = useState('chart')
  const handleSetView = useCallback(view => {
    window.scrollTo({ top: 0 })
    setView(view)
  }, [setView])
  const isMobile = useMobile()

  const locationFilter = useMemo(() => {
    if (ladState.currentLad === 'national') {
      return {
        category: 'National overview',
        heading: 'England',
        subheading: (
          <span className='flex items-center text-subheading'>
            Explore local authorities {
            isMobile
              ? <button onClick={() => handleSetView('map')} className='px-1 underline text-primary font-medium'>on the map</button>
              : 'on the map'
            }
          </span>
        )
      }
    }
    return {
      category: 'Local authority',
      heading: LALookupTable[ladState.currentLad],
      subheading: ladState.currentLad,
      showNationalButton: ladState.loadingLad !== 'national',
      loadNationalOverview: () => ladActions.load('national')
    }
  }, [ladState, isMobile])

  const formattedDate = useMemo(() => format(new Date(date), 'd MMMM y'), [date])

  const dateFilter = {
    dates: results ? results.dates : null,
    label: formattedDate,
    value: date,
    onChange: handleDateSlider,
    playing: playing,
    setPlaying: setPlaying
  }

  return (
    <>
      { isMobile && view === 'chart' &&
        <LocationFilter
          className='px-4 pt-3 pb-0 bg-white relative'
          {...locationFilter}
        /> }
      { !isMobile &&
        <FilterSection>
          <DateFilter className='w-80' {...dateFilter} />
          <div className='border border-gray-200 mx-6 hidden md:block' />
          <LocationFilter className='w-80 relative' {...locationFilter} />
        </FilterSection> }
      <Card className={classNames('flex-grow flex flex-col md:grid md:grid-cols-2 md:grid-rows-1-full md:gap-6 pt-3 md:px-6 md:py-6', { 'pb-0': isMobile && view === 'map' })}>
        <div className={classNames('flex flex-col flex-grow', { hidden: isMobile && view === 'chart' })}>
          <div className='flex justify-between items-center space-x-6'>
            <Heading>Map</Heading>
            {isMobile &&
              <PillButton
                className='flex items-center space-x-1 min-w-0 h-8 pr-2'
                onClick={() => handleSetView('chart')}
              >
                <span className='truncate'>{locationFilter.heading}</span>
                <BsArrowRightShort className='w-6 h-6' />
              </PillButton> }
          </div>
          <form className={classNames(
            'grid grid-cols-3 gap-3 max-w-md lg:flex lg:gap-0 lg:space-x-3 lg:max-w-none text-sm pb-3 mt-2 md:mt-3 transition-opacity',
            { 'opacity-50 pointer-events-none': lineageState.status === 'LOADING' }
          )}>
            <div>
              <label className='block font-medium mb-1'>
                Lineage
              </label>
              <Select
                value={lineageState.loading.lineage || lineageState.lineage}
                name='lineages'
                onChange={e => lineageActions.setLineage(e.target.value)}
              >
                {unique_lineages.map((x) => <option key={x}>{x}</option>)}
              </Select>
            </div>
            <div>
              <label className='block font-medium mb-1'>
                Color by
              </label>
              <Select
                value={lineageState.loading.parameter || lineageState.parameter}
                name='parameters'
                onChange={e => lineageActions.colorBy(e.target.value)}
              >
                {parameter_options}
              </Select>
            </div> {lineageState.parameter !== 'R' &&
              <div>
                <label className='block font-medium mb-1'>
                  Scale
              </label>

                <Select
                  value={lineageState.scale || ''}
                  name='color_scale_type'
                  onChange={e => lineageActions.setScale(e.target.value)}
                >
                  <option value='linear'>Linear</option>
                  <option value='quadratic'>Quadratic</option>
                </Select>
              </div>}
          </form>
          <div className='relative flex-grow -mx-3 md:m-0 flex flex-col md:rounded-md overflow-hidden'>
            <Chloropleth
              className='flex-grow'
              lad={ladState.loadingLad || ladState.currentLad}
              tiles={tiles}
              color_scale_type={lineageState.parameter === 'R' ? 'R_scale' : lineageState.scale}
              max_val={results ? results.max : 0}
              min_val={results ? results.min : 0}
              index={results ? results.index : null}
              date={date}
              handleOnClick={handleOnClick}
              isMobile={isMobile}
              percentage={lineageState.parameter === 'p'}
              lineColor={lineColor}
            />
            <FadeTransition in={lineageState.status === 'LOADING'}>
              <div className='bg-white bg-opacity-50 absolute inset-0 grid place-content-center'>
                <Spinner className='text-gray-500 w-6 h-6' />
              </div>
            </FadeTransition>
            <div className='absolute inset-0 shadow-inner pointer-events-none' style={{ borderRadius: 'inherit' }} />
          </div>
        </div>
        <LocalIncidence
          className={classNames(
            'transition-opacity flex-grow', {
              hidden: view === 'map',
              'opacity-50 pointer-events-none': ladState.status === 'LOADING'
            }
          )}
          name={LALookupTable[ladState.currentLad]}
          date={date}
          setDate={setDate}
          lad={ladState.currentLad}
          values={ladState.data}
          isMobile={isMobile}
          lineColor={lineColor}
        />
        { isMobile && view === 'chart' &&
          <StickyActionButton
            onClick={() => handleSetView('map')}
          >
            View map on {formattedDate}
          </StickyActionButton> }
      </Card>
      { isMobile && view === 'map' &&
        <DateFilter className='p-3 bg-white shadow border-t border-gray-100' {...dateFilter} /> }
    </>
  )
}

export default Covid19
