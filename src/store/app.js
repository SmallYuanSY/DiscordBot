import {defineStore} from 'pinia'

export const useAppStore = defineStore('counter', {
  state: () => ({
    client: null,
    commandsActionMap: null
  }),
  getters: {},
  actions: {},
})