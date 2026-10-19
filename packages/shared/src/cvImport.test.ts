import { expect, test } from 'vitest'
import { extractContact } from './cvImport.ts'

test('extractContact finds name, email and phone in a typical CV header', () => {
  const cv = `Curriculum Vitae
Łukasz Wiśniewski-Nowak
Warsaw | lukasz.wn@example.com | tel. +48 600 000 123
Frontend developer, 2020-2024 at Example Sp. z o.o.`
  expect(extractContact(cv)).toEqual({
    firstName: 'Łukasz',
    lastName: 'Wiśniewski-Nowak',
    email: 'lukasz.wn@example.com',
    phone: '+48 600 000 123',
  })
})

test('extractContact leaves fields empty instead of guessing from years or sentences', () => {
  const cv = `experienced developer with react
Worked 2019-2022 and 2022-2024 on billing systems.`
  expect(extractContact(cv)).toEqual({ firstName: '', lastName: '', email: '', phone: '' })
})

test('extractContact takes the two leading capitalised words when there is no name line', () => {
  expect(extractContact('Nadia Okafor nadia@ex.io 600000199')).toMatchObject({
    firstName: 'Nadia',
    lastName: 'Okafor',
  })
})
