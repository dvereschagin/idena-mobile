import React from 'react'
import { useRpc, usePoll } from './lib'

export const EpochPeriod = {
  FlipLottery: 'FlipLottery',
  ShortSession: 'ShortSession',
  LongSession: 'LongSession',
  AfterLongSession: 'AfterLongSession',
  None: 'None',
}

const EpochStateContext = React.createContext()
export function EpochProvider(props) {
  const [{ result: epoch }] = usePoll(useRpc('dna_epoch'), 1000 * 1)
  return <EpochStateContext.Provider value={epoch} {...props} />
}

export function useEpochState() {
  const context = React.useContext(EpochStateContext)
  if (context === undefined) {
    throw new Error('useEpochState must be used within a EpochProvider')
  }
  return context
}

const TimingStateContext = React.createContext()
export function TimingProvider(props) {
  const [{ result: timing }] = usePoll(
    useRpc('dna_ceremonyIntervals'),
    1000 * 60
  )
  return <TimingStateContext.Provider value={timing} {...props} />
}

export function useTimingState() {
  const context = React.useContext(TimingStateContext)
  if (context === undefined) {
    throw new Error('useTimingState must be used within a TimingProvider')
  }
  return context
}
