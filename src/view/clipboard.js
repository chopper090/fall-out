// Il testo della casella area va negli appunti, e note lo dice (copied): lo usano la schermata dell'errore e le schede
// degli strumenti di sviluppo. Fuori da https (il telefono sul server di sviluppo) gli appunti non si possono scrivere:
// il testo resta selezionato, da copiare a mano (copyHint)
export async function copyText(area, note, { copied, copyHint }) {
  try {
    await navigator.clipboard.writeText(area.value);
    note.textContent = copied;
  } catch {
    area.focus();
    area.select();
    note.textContent = copyHint;
  }
}
