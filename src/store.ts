import level from 'level-ts'

export const db = new level('./peerdb')

export const objdb = new level('./objdb')
