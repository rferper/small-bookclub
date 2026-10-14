import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const pages = [
  ['/', 'Inicio'], ['/biblioteca', 'Biblioteca'], ['/biblioteca/b2', 'Cumbres borrascosas'],
  ['/biblioteca/b2/valorar', 'Editar mi valoración de «Cumbres borrascosas»'], ['/reuniones', 'Reuniones'], ['/votaciones', 'Votaciones'],
  ['/estadisticas', 'Estadísticas'], ['/miembros', 'Miembros'], ['/mi-perfil', 'Mi perfil'],
  ['/administracion/miembros', 'Miembros y curaduría'], ['/administracion/libros/nuevo', 'Añadir libro'],
  ['/administracion/reuniones/nueva', 'Crear reunión'], ['/administracion/rubrica', 'Rúbrica de valoración'],
  ['/?mock-session=anonymous', 'Club de Lectura'], ['/?mock-session=denied', 'Esta cuenta no tiene acceso al club'],
] as const

for (const [url, heading] of pages) {
  test(`axe ${url}`, async ({ page }, testInfo) => {
    await page.goto(url)
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeAttached()
    await expect(page.getByText('Cargando…', { exact: true })).toHaveCount(0)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    await testInfo.attach('axe-results', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' })
    expect(results.violations).toEqual([])
    const weakBorders = await page.evaluate(() => {
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(channel => {
          const value = channel / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        })
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
      }
      return [...document.querySelectorAll<HTMLInputElement>('input:not([type="radio"]):not([type="checkbox"]):not([type="file"]),select,textarea')]
        .filter(el => !el.disabled && el.getBoundingClientRect().width > 0)
        .map(el => {
          const style = getComputedStyle(el), border = luminance(style.borderColor), surface = luminance(style.backgroundColor)
          return { name: el.id || el.name, ratio: (Math.max(border, surface) + 0.05) / (Math.min(border, surface) + 0.05) }
        }).filter(control => control.ratio < 3)
    })
    expect(weakBorders).toEqual([])
  })
}

test('keyboard skip link and profile validation keep visible focus', async ({ page }) => {
  await page.goto('/mi-perfil')
  await expect(page.getByLabel('Nombre visible', { exact: true })).toBeVisible()
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Saltar al contenido' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  expect(await skip.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
  await page.keyboard.press('Enter')
  await page.getByLabel('Nombre visible', { exact: true }).fill(' ')
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Nombre visible', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Nombre visible', { exact: true })).toHaveAttribute('aria-invalid', 'true')
})

test('confirmation keyboard focus stays inside and returns on Escape', async ({ page }) => {
  await page.goto('/administracion/copias')
  const open = page.getByRole('button', { name: 'Exportar datos', exact: true })
  await open.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  const cancel = dialog.getByRole('button', { name: 'Cancelar', exact: true })
  const confirm = dialog.getByRole('button', { name: 'Confirmar exportación', exact: true })
  await expect(cancel).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(confirm).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(cancel).toBeFocused()
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(open).toBeFocused()
})

test('statistics reflow with a classic scrollbar and reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/estadisticas')
  await expect(page.getByRole('region', { name: 'Media del club por libro', exact: true })).toBeVisible()
  await page.addStyleTag({ content: 'html{overflow-y:scroll}::-webkit-scrollbar{width:15px}' })
  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }))
  expect(width.document).toBeLessThanOrEqual(width.viewport)
  const motion = await page.getByRole('main').evaluate(el => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, duration: getComputedStyle(el).transitionDuration }))
  expect(motion.reduced).toBe(true)
  expect(parseFloat(motion.duration)).toBeLessThanOrEqual(0.00001)
  await page.getByRole('region', { name: 'Media del club por libro', exact: true }).screenshot({ path: testInfo.outputPath('book-statistics.png') })
  await page.getByLabel('Comparar con', { exact: true }).selectOption('m3')
  // Stress the existing fictional row with the long-title case reported in QA.
  await page.getByRole('region', { name: 'Gustos en común', exact: true }).getByRole('table').last().getByRole('link').first()
    .evaluate(el => { el.textContent = 'El ingenioso hidalgo don Quijote de la Mancha' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.getByRole('region', { name: 'Gustos en común', exact: true }).screenshot({ path: testInfo.outputPath('shared-books.png') })
})
