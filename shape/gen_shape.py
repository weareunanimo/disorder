import math
def f(v):
    s=('%.3f'%v).rstrip('0').rstrip('.')
    return s if s not in ('-0','') else '0'
def ring(o, sh, cs=5, ss=6):
    O = (lambda sign: (' %s %s'%('+' if sign>0 else '-', o)) if o else '')
    S = (' + '+sh) if sh else ''
    two_o = (' - 2*%s'%o) if o else ''
    AX,BX,CX,DX='var(--Ax)','var(--Bx)','var(--Cx)','var(--Dx)'
    AY,BY,CY,DY='var(--Ay)','var(--By)','var(--Cy)','var(--Dy)'
    dx,dy='var(--dx)','var(--dy)'
    pts=[]
    def c(expr): return 'calc(%s%s)'%(expr,S)
    def corner(fx, fy):
        for i in range(cs+1):
            ph=math.pi/2*i/cs
            pts.append((c(fx(ph)), c(fy(ph))))
    def side(fx, fy):
        for i in range(1,ss):
            t=i/ss; k=(2*t-1)**2
            pts.append((c(fx(t,k)), c(fy(t,k))))
    lo = (o+' + ') if o else ''
    hi = '100%' + ((' - '+o) if o else '')
    r1,r2,r3,r4='var(--q1)','var(--q2)','var(--q3)','var(--q4)'
    corner(lambda p: f'{lo}{AX} - {f(math.cos(p))}*{r1}', lambda p: f'{lo}{AY} - {f(math.sin(p))}*{r1}')
    side(lambda t,k: f'{lo}{AX} + {f(t)}*(100%{two_o} - {AX} - {BX})', lambda t,k: f'{lo}{f(k)}*{dy}')
    corner(lambda p: f'{hi} - {BX} + {f(math.sin(p))}*{r2}', lambda p: f'{lo}{BY} - {f(math.cos(p))}*{r2}')
    side(lambda t,k: f'{hi} - {f(k)}*{dx}', lambda t,k: f'{lo}{BY} + {f(t)}*(100%{two_o} - {BY} - {CY})')
    corner(lambda p: f'{hi} - {CX} + {f(math.cos(p))}*{r3}', lambda p: f'{hi} - {CY} + {f(math.sin(p))}*{r3}')
    side(lambda t,k: f'{hi} - {CX} - {f(t)}*(100%{two_o} - {CX} - {DX})', lambda t,k: f'{hi} - {f(k)}*{dy}')
    corner(lambda p: f'{lo}{DX} - {f(math.sin(p))}*{r4}', lambda p: f'{hi} - {DY} + {f(math.cos(p))}*{r4}')
    side(lambda t,k: f'{lo}{f(k)}*{dx}', lambda t,k: f'{hi} - {DY} - {f(t)}*(100%{two_o} - {DY} - {AY})')
    return [x+' '+y for x,y in pts]
p0=ring('', ''); ps=ring('', 'var(--s)'); pi=ring('var(--w)', '')
U='polygon('+', '.join(p0+[p0[0]]+ps+[ps[0]])+')'
I='polygon('+', '.join(pi)+')'
SEL='.list.grid .link, .btn:not(.ghost), .chip, .sblock, .banner, .fab, .seg, .pv'
VAR=open('variants.css').read()
css=f'''
/* Forma do logo: cantos redondos ou vivos e os quatro lados levemente abaulados. Gerado por shape/gen_shape.py, não editar os polígonos à mão. */
{SEL} {{
  --r1: initial; --r2: initial; --r3: initial; --r4: initial; --shc: var(--ink);
  --q1: var(--r1, var(--r)); --q2: var(--r2, var(--r)); --q3: var(--r3, var(--r)); --q4: var(--r4, var(--r)); --w: 2px; --bd: 2px;
  --dx: var(--d); --dy: var(--d);
  --Ax: (var(--q1) + var(--dx)); --Bx: (var(--q2) + var(--dx)); --Cx: (var(--q3) + var(--dx)); --Dx: (var(--q4) + var(--dx));
  --Ay: (var(--q1) + var(--dy)); --By: (var(--q2) + var(--dy)); --Cy: (var(--q3) + var(--dy)); --Dy: (var(--q4) + var(--dy));
  --sq-u: {U};
  --sq-i: {I};
  position: relative; border-color: transparent !important; border-radius: 0 !important; box-shadow: none !important; clip-path: var(--sq-u);
}}
.fab {{ position: fixed; }}
:is({SEL})::after {{ content: ""; position: absolute; inset: calc(var(--bd) * -1); z-index: -2; background: var(--shc, var(--ink)); pointer-events: none; }}
:is({SEL})::before {{ content: ""; position: absolute; inset: calc(var(--bd) * -1); z-index: -1; background: inherit; clip-path: var(--sq-i); pointer-events: none; }}
'''
css+=VAR
open('shape.css','w').write(css); print(len(css), len(p0))
