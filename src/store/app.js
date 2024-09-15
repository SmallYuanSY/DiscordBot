import {defineStore} from 'pinia'

export const useAppStore = defineStore('counter', {
  state: () => ({
    client: null,
    user: null,
    commandsActionMap: null
  }),
  getters: {},
  actions: {},
})