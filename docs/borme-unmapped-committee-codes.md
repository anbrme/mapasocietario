# BORME committee codes with no expansion

Working list for decoding against the BORME. Every code here is a real registry
cargo present in `terms.json`; what is missing is only the committee's name.

Two consequences today, and the second is the one that matters:

1. it renders as `<role> de una comisión (<code>)` — the role is read, the organ
   is not;
2. `organKindFor` returns `OTHER_ORGAN`, and under default-deny that implies NO
   directorship. If the code names a committee OF the board, its holder is a
   sitting consejero being kept off the board table.

Adding one is two lines: a token in `BOARD_COMMITTEE` (`src/utils/organKinds.js`
plus the Python port) and a name in `COMMITTEE_NAMES`
(`src/utils/positionLabels.js`). See the SCI commit for the shape, including the
kind of corroboration worth having before promoting a code to a directorship —
there, the registry's own `CONS.COM.SCI` showed a consejero on the same
committee.

Grouped by the token left after stripping the role prefix and the COM/CTE/C
organ word, so one lookup settles a whole family. **The stripping is crude**: a
few tokens are mangled (`UPL.COMI.LI` is `SUPL.COMI.LI`, `ICOEMPA` is
`MICOEMPA`) — read the codes column, not the token, where they disagree.

Ordered by number of spellings, which is a rough proxy for how common the
committee is. Seat counts from the live index would be a better one and are not
in here.

| token | n | codes |
|---|---|---|
| `INV` | 10 | PR.C.INV, PRES.CMS.INV, PRES.COM.INV, PTE.COM.INV, SECR.CMS.INV, SECR.COM.INV, VSEC.COM.INV, M.COM.INV, MBRO.CMS.INV, MBRO.COM.INV |
| `O.S` | 10 | PRE.COMS.O.S, PRES.COM.O.S, VPRE.COM.O.S, SEC.COMS.O.S, SECR.COM.O.S, VSEC.COM.O.S, VOSU.COM.O.S, VOTI.COM.O.S, MIEM.COM.O.S, MRO.COMS.O.S |
| `(bare)` | 9 | PRES.COM.., VICEPRE.COM., VICPRES.COM., SECR.COM.., SECRCOMIGEST, SECRCOMINDP, SECRCOMOPVIN, VICSEC. COM., MIEM.COM. |
| `CTO` | 5 | PRES.COM.CTO, V-P1.COM.CTO, V-P2.COM.CTO, SECR.COM.CTO, MBRO.COM.CTO |
| `J.G.P.V` | 5 | PRES.J.G.P.V, VPRE.J.G.P.V, SEC.J.G.P.V, VSEC.J.G.P.V, MIEM.J.G.P.V |
| `PER` | 5 | PRE.COMS.PER, VICP.COM.PER, VP1.COMS.PER, MIE.COM.PER., MRO.COMS.PER |
| `D.C.A` | 4 | PRES.C.D.C.A, VPRE.C.D.C.A, SEC.C.D.C.A, MIEM.C.D.C.A |
| `DIR` | 4 | PRES.COM.DIR, SECR.COM.DIR, MBRO.COM.DIR, MRO.COMS.DIR |
| `E.O.S` | 4 | P.COMS.E.O.S, VP1COM.E.O.S, VP2COM.E.O.S, M.COMS.E.O.S |
| `GER` | 4 | PRE.COM.GER, SEC.COM.GER, MBRO.COM.GER, MIEM.COM.GER |
| `IN` | 4 | PRE.COM.IN, V-PRE.COM.IN, VPRES.COM.IN, V-SEC.COM.IN |
| `PRO` | 4 | PRES.C.PRO, VPRE.C.PRO, SEC.C.PRO, MIEM.C.PRO |
| `SEG` | 4 | PRE.COMS.SEG, PRES.COM.SEG, SEC.COMS.SEG, MIEM.COM.SEG |
| `SEGURI` | 4 | PRE.C.SEGURI, SEC.C.SEGURI, VSE.C.SEGURI, MRO.C.SEGURI |
| `AR` | 3 | PRE.COM.AR, SEC.COM.AR, MIE.COM.AR |
| `C` | 3 | V-PRE.COMS.C, SEC.COMS.C, V-SEC.COMS.C |
| `CFP` | 3 | PRE.COM.CFP, SEC.COM.CFP, MIE.COM.CFP |
| `CRT` | 3 | PRES.COM.CRT, SECR.COM.CRT, MBRO.COM.CRT |
| `CYA` | 3 | PDTE.COM.CYA, SECR.COM.CYA, MBRO.COM.CYA |
| `E` | 3 | V-PRE.COMS.E, V-SEC.COMS.E, VICSEC.COM.E |
| `EIC` | 3 | PRES.COM.EIC, SECR.COM.EIC, MIEM.COM.EIC |
| `FVS` | 3 | PRE.COM.FVS, SEC.COM.FVS, MIE.COM.FVS |
| `REP` | 3 | PRE.COM.REP., SEC.COM.REP., MIE.COM.REP. |
| `A.YC` | 2 | PRE.COM.A.YC, SEC.COM.A.YC |
| `D` | 2 | V-PRE.COMS.D, V-SEC.COMS.D |
| `DER` | 2 | PRE.COMS.DER, SEC.COMS.DER |
| `EYS` | 2 | PRE.COM.EYS, MIE.COM.EYS |
| `GRS` | 2 | PRES.COM.GRS, MIEM.COM.GRS |
| `IGEST` | 2 | PRESCOMIGEST, MIEMCOMIGEST |
| `IT.AU` | 2 | PTE.COMIT.AU, SEC.COMIT.AU |
| `ITT` | 2 | PRES.COM.ITT, MIEM.COM.ITT |
| `J.R` | 2 | VICSECR.J.R., TESORERO J.R |
| `L` | 2 | V-PRE.COMS.L, V-SEC.COMS.L |
| `OEMPA` | 2 | PRECOEMPA, SECOEMPA |
| `OPVIN` | 2 | PRESCOMOPVIN, MIEMCOMOPVIN |
| `PERM` | 2 | PRE.COM.PERM, SEC.COM.PERM |
| `SEQ` | 2 | PRE.COMS.SEQ, MRO.COMS.SEQ |
| `SUP` | 2 | PRE.COM.SUP., SECR.COM.SUP |
| `1.COMS.E` | 1 | V-P.1.COMS.E |
| `2.COMS.E` | 1 | V-P.2.COMS.E |
| `3.COMS.E` | 1 | V-P.3.COMS.E |
| `A.G.P.V` | 1 | SEC.A.G.P.V |
| `ACP` | 1 | MIE.COM.ACP |
| `ACR` | 1 | MIEM.COM.ACR |
| `ARC` | 1 | MIEM.COM.ARC |
| `ASE` | 1 | MBRO.COM.ASE |
| `ASESO` | 1 | M.COM. ASESO |
| `AU` | 1 | VPRES.COM.AU |
| `CF` | 1 | MIEMB.CTE.CF |
| `COM.PERM` | 1 | M.C.COM.PERM |
| `CONS` | 1 | SEC.COM.CONS |
| `CONS.FAM` | 1 | COM.CONS.FAM |
| `CONSU` | 1 | M.COM.CONSU. |
| `CONTR` | 1 | PR.COM,CONTR |
| `CRE` | 1 | SEC.COM.CRE |
| `CT` | 1 | VICES.COM.CT |
| `D.I` | 1 | PRE.COMS.D.I |
| `DE` | 1 | VPRE.COM.DE |
| `E.IN.C` | 1 | M.CMS.E.IN.C |
| `EC.C.DL` | 1 | VICESEC.C.DL |
| `ECONORE` | 1 | MECONORE |
| `ES.I.C` | 1 | P.CMS.ES.I.C |
| `FIN` | 1 | MIEM.COM.FIN |
| `FIYEC` | 1 | MIEMCOMFIYEC |
| `GERE` | 1 | PRE.COM.GERE |
| `GERENCIA` | 1 | COM.GERENCIA |
| `I.PERMA` | 1 | M.COMI.PERMA |
| `I.RES` | 1 | PTE.COMI.RES |
| `ICOEMPA` | 1 | MICOEMPA |
| `INDP` | 1 | MIEMCOMINDP |
| `ISIO` | 1 | MBRO.COMISIO |
| `IT.INV` | 1 | M.COMIT.INV |
| `MIX` | 1 | MIEMCOMMIX |
| `N` | 1 | VICSEC.CTE.N |
| `N.R` | 1 | SEC.COM.N.R. |
| `ON.DIR` | 1 | VOC.CON.DIR. |
| `ONORE` | 1 | SECONORE |
| `R.COM.AU` | 1 | VSECR.COM.AU |
| `R.COM.IN` | 1 | VSECR.COM.IN |
| `RS` | 1 | MIE.COM.RS |
| `SEG.FO` | 1 | M.COM.SEG.FO |
| `SEGUIM` | 1 | COMS.SEGUIM. |
| `SUP.CO` | 1 | M.COM.SUP.CO |
| `SUPL.COM.R` | 1 | M.SUPL.COM.R |
| `T.COM.RE` | 1 | MRO.T.COM.RE |
| `UPL.COMI.C` | 1 | SUPL.COMI.C. |
| `UPL.COMI.LI` | 1 | SUPL.COMI.LI |
| `UPL.COMISIO` | 1 | SUPL.COMISIO |
| `UPL.COMS.AC` | 1 | SUPL.COMS.AC |
| `UPL.COMS.CT` | 1 | SUPL.COMS.CT |
| `UPL.COMS.SE` | 1 | SUPL.COMS.SE |
| `UPL.COMS.VI` | 1 | SUPL.COMS.VI |
| `V-S1.COM.CTO` | 1 | V-S1.COM.CTO |
| `V-S2.COM.CTO` | 1 | V-S2.COM.CTO |
| `VCSEC. C.A` | 1 | VCSEC. C.A. |
| `VICEP.C.PERM` | 1 | VICEP.C.PERM |
| `VIG` | 1 | MRO.COMS.VIG |
| `VIGILAN` | 1 | COMS.VIGILAN |
| `VTE.COM.DIR` | 1 | VTE.COM.DIR. |
