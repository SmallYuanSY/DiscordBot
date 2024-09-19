import {defineStore} from 'pinia'

export const useAppStore = defineStore('counter', {
  state: () => ({
    client: null,
    user: null,
    commandsActionMap: null,
    buttonsActionMap: null,
    selectMenusActionMap: null
  }),
  getters: {},
  actions: {},
})