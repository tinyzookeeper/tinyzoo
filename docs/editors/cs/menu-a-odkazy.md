# Menu a odkazy

Jak upravit menu webu, udělat rozbalovací nabídku, odkazovat tak, aby se odkaz nerozbil, a poslat návštěvníky ze staré adresy na novou.

> Názvy se u vašeho webu mohou lišit. Základní web má část **Navigace** a **Přesměrování**.

## Menu webu

Menu jsou v části **Navigace**. Obvykle jsou dvě:

- **Hlavní menu**: lišta nahoře na webu,
- **Menu v patičce**: odkazy dole.

Každé menu je seznam odkazů. Zveřejnit zvlášť není co: menu se na web dostane **hned po uložení** (**Změny se na webu ukážou hned po uložení.**). Proto po každé úpravě zkontrolujte web.

### Přidat odkaz

1. Otevřete **Navigace** a najděte menu, které chcete změnit.
2. Klikněte na **Přidat položku**.
3. Vyplňte:
   - **Text odkazu**: slova, která návštěvník uvidí (třeba „Kontakt“).
   - **Adresa**: kam odkaz vede (viz níže).
   - **Otevřít v nové záložce**: zaškrtněte u odkazů na cizí weby, aby návštěvník nezmizel z vašeho.
   - **Pod odkazem nad ním**: viz rozbalovací nabídka níže.
4. Klikněte na **Uložit**.

Má web víc jazyků, má každý jazyk své vlastní menu: přepněte jazyk (viz [Překlady](preklady.md)) a upravte ho zvlášť. Pokud menu v jazyce chybí, použije se výchozí.

Pořadí změníte přetažením odkazu. Nepotřebný odkaz odeberete tlačítkem **Odebrat**. Dokud nekliknete na **Uložit**, nic se nemění.

<!-- screenshot: úprava hlavního menu: seznam odkazů s polem Text odkazu, Adresa a přepínači -->

### Rozbalovací nabídka

Chcete, aby se po najetí na **O nás** rozbalilo **Tým** a **Historie**? Odkaz, který má být v rozbalené nabídce, dejte v seznamu **hned pod** hlavní odkaz a zaškrtněte u něj **Pod odkazem nad ním**. Správa k tomu řekne: *Zobrazí se v rozbalovacím menu odkazu nad ním.* Pod jeden odkaz můžete dát víc takových.

> **Tip:** Chcete-li odkaz zase vrátit do hlavní lišty, zrušte zaškrtnutí. Ověřte si, že pořadí nevypadá jinak, než čekáte. Odkazy v rozbalené nabídce jsou vždy pod tím, ke kterému patří.

Jak se rozbalovací nabídka na webu chová a vypadá, určuje vzhled webu. Správa jen určuje, co kam patří.

## Kam odkaz vede

Pole **Adresa** (a odkaz v textu) umí dvě věci. Zkuste do pole psát:

- **Název stránky**: začněte psát a správa nabídne stránky vašeho webu (**Na tomto webu**). Vyberte tu správnou.
- **Celou adresu**: například `https://www.firma.cz`, `mailto:info@firma.cz` pro e-mail nebo `tel:+420123456789` pro telefon. Správa to nabídne jako **Odkaz na …**.

Když pole zůstane prázdné nebo zadáte nesmysl, ukáže se **Zadejte /stránku, https://…, mailto: nebo tel:**.

> **Tip:** Na stránku vlastního webu odkazujte **výběrem z nabídky**, ne ručním psaním adresy. Proč, vysvětluje další odstavec.

### Odkazy, které se samy opraví

Když vyberete stránku z nabídky, správa si zapamatuje **tu stránku**, ne její adresu. Pod odkazem uvidíte **Odkaz se přizpůsobí, když se změní adresa stránky**. Když pak stránku přejmenujete, přesunete pod jinou, nebo přeložíte, **odkaz dál funguje**. Menu, tlačítka na stránkách i odkazy v textu se opraví samy.

Pod odkazem vidíte název stránky a její adresu v jazyce, který zrovna upravujete. K tomu mohou přibýt varování:

- **Zatím nezveřejněno: návštěvníci tu uvidí odkaz, až bude stránka zveřejněná.** Odkaz se na webu neukáže, dokud nezveřejníte stránku, na kterou vede.
- **Tahle stránka už neexistuje, takže tu návštěvníci žádný odkaz neuvidí. Vyberte jinou stránku.** Cílová stránka byla smazána.

Správa tedy nedovolí smazat stránku, na kterou ještě něco odkazuje (viz **Pořád se to používá** v kapitole [Stránky a bloky](stranky-a-bloky.md)). Řekne vám, kde je odkaz, a vy ho tam nejdřív upravíte.

Odkaz změníte tlačítkem **Změnit odkaz**, odeberete ho tlačítkem **Odebrat odkaz**. Stránku vyberete tlačítkem **Vybrat stránku**.

> **Pozor:** Starší odkazy, které někdo kdysi napsal ručně jako adresu, se samy neopraví. Vývojář je může převést jednou provždy. Když se po přesunu stránek některé rozbily, řekněte mu to.

## Přesměrování

Co když někdo má stránku v záložkách, nebo ji najde ve vyhledávači, a vy jste ji přejmenovali? Přesměrování pošle návštěvníka ze staré adresy automaticky na novou.

Najdete je v části **Přesměrování**. Přidejte nové a vyplňte:

- **Z adresy**: stará adresa na vašem webu, například `/stara-stranka`. Začíná lomítkem.
- **Na adresu**: kam návštěvníka poslat, buď stránka tohoto webu (**Vybrat stránku**), nebo jiný web (`https://…`).
- **Trvalé**: nechte zaškrtnuté, pokud se stránka přesunula navždy. Vyhledávače si pak zapamatují novou adresu. Zrušte, jen když jde o dočasnou věc.

Přesměrování platí na webu **hned po uložení**. Správa nedovolí udělat kruh (adresa A na B a B zpátky na A): ukáže **Jiné přesměrování už vede sem zpátky, návštěvníci by chodili v kruhu. Vyberte jinou adresu.**

> **Pozor:** Přesměrování smí vytvářet jen administrátor a editor, protože se projeví na webu okamžitě.

Při přesunu stránky ve [stromu stránek](stranky-a-bloky.md) správa vytvoří přesměrování ze starých adres sama, pokud je tahle část na webu zapnutá.

## Viz také

- [Stránky a bloky](stranky-a-bloky.md): strom stránek a mazání
- [Překlady](preklady.md): menu v jiném jazyce
- [Co dělat, když něco nefunguje](kdyz-neco-nefunguje.md): „Odkaz v menu se nezobrazuje“
