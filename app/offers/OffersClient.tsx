'use client';
import { useState, useRef } from 'react';
import clsx from 'clsx';
import { useToast } from '@/components/Toast';
import EditGate from '@/components/EditGate';

type EmpType = 'contractor' | 'employee';

interface Form {
  name: string; email: string; role: string; dept: string;
  salary: string; startDate: string; location: string; notes: string;
}

const EMPTY: Form = { name: '', email: '', role: '', dept: '', salary: '', startDate: '', location: '', notes: '' };

type LetterKind = 'offer' | 'declination' | 'general';

// Declination letter — a fixed template on Litson letterhead with fillable
// fields (no AI). Mirrors the firm's sample declination-of-representation letter.
interface DecForm {
  date: string; name: string; email: string; salutation: string;
  re: string; body: string; signer: string;
}
const DEC_DEFAULT_BODY = 'Thank you for your interest in Litson PLLC representing you in connection with your case. As you know, we have not signed an engagement letter and have not created an attorney-client relationship. We will not be able to take your case at this time but wish you the best.';
const DEC_EMPTY: DecForm = {
  date: '', name: '', email: '', salutation: '',
  re: 'Declination of Representation', body: DEC_DEFAULT_BODY, signer: 'J. Alex Little',
};
function fmtLongDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Escape HTML, then apply lightweight inline markdown so users can bold/italic
// parts of a letter: **bold**, *italic* (or __bold__ / _italic_). Bold is
// resolved before italic so the double markers win. Used for both the live
// preview and the print/PDF output so they always match.
function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inlineMd(escaped: string) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|[^a-zA-Z0-9])_(.+?)_(?![a-zA-Z0-9])/g, '$1<em>$2</em>');
}
function fmtInline(raw: string) { return inlineMd(escHtml(raw)); }

// General letter — a fully fillable letter on Litson letterhead (no AI) for
// anything that isn't an offer or declination: financial sponsorship, proof of
// employment, reference letters, etc. Addressee, Re:, a free-text body, signer
// and an optional cc block.
interface GenForm {
  date: string; addressee: string; re: string; greeting: string;
  body: string; signer: string; signerTitle: string; cc: string; withSig: boolean;
}
const GEN_EMPTY: GenForm = {
  date: '', addressee: 'To Whom It May Concern:', re: '', greeting: '',
  body: '', signer: 'Alex Little', signerTitle: 'Managing Member', cc: '', withSig: true,
};

const LOGO_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA+gAAAFNCAIAAAAcj9LHAAAX+UlEQVR4nO3dv8sd15kH8OffUbdxIlu2HHsFARUmhQOCVEkKNw4p3KgxBrvLYrYUqJSIKiGQG8HCFtsIFXIjBCoWEtJFu/X+A9mDL4gX3Vf3mXvvzDxnZj7wKRzH0vs9586P7533zExc+Zd/BQAAOhflCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAKh19fpn5Rl69vuf/7L5/L1PypOwcVGeAACo9ejxk1//5g/lMbryp1/88odrH/3j+gf//Pj9i9q/af++9fjyhGxQlCcA4LAbN2/99nd//Ld/v9Pcf/DwP/7zvy7a/fuvbn/b/pvyqD27OI137t57axrbxO7+ry++vL3BmWwz8Ne//V1332mlfL+v7/vxw2uuwTOzKE/Auu1OhKl2Qi2POr/WtIZMTs8don1wAz/iEoverq5e/6xtIY8eP2l16vX//O9wT589b620tc/yIfRg19RbKz1qDt/MZGvz7VPYwjKS3RS1ja2fA87ww8u4P/cvH3yUVvaLvr76cflcsR1RnoB1G3iC7OdUMaeBZWL009KI2gd3Qh+azUK3qxa79fXzh99KWOud27yG2r63tLEf+53ncIlfd4O/eDhqIy3Pc+WYw8uIP/SHa8e19p32p8qni42I8gSs27oL1pkU96ktbrtqgU+7NnxY+zsXNxWnacW67S8vXr6abqNq3wcW/Zucd3lrw+uhu89f3E9r7Tt/dt2dWUR5AtZtrQVrFIr71Ba0XbXGOcpV9gPa37/KxvlmAtueMuIl9sPWV9/3D0fl3X3m4v6nX/zy5Na+Y707M4jyBKzb+grWiBT3qS1lu2o552mc7aeUD3YKrWLOVtkvunP33moWz1x6OKrt7nMW9/d/9umQu1HTe1XLP0dWL8oTsG4rK1jjUtyntojtqnWjOeekfLzjunHz1hSLi4ZrXxjWcR/wu6axsLvPWdy/vvrxma19xzMimVqUJ2Dd1lSwRqe4T63/7Wrm1j5KxelHa8wlF9r33X/wcOmX3g8cjqq6+5zF/ccPr41S3N2lytSiPAHrtpqCNQXFfWqdb1fzt/ZRKk4n7ty9V76BXfT02fNFr3o/fDgq6e5zFvdRWvs/f3o3U/lHybpFeQLWbR0FayKK+9R63q5+/Zs/lMxJ+cDPd/X6Z7XLY95l0S8wSqd0/u4+W3H//L1PxiruTflHybpFeQLWbQUFazqK+9R63q6ePnteMiflAz9Ta+1VUzfEcpe8DzkczdzdZyvuv//5uc+TUdyZTZQnYN1WULCmo7hPrdvtqmSRzCgVp1bnrf2N8gcpnmDg4WjOoS20uP/qvU/LP01WLMoTsG4DD7vdFqxJKe5T63a7OvkNQa22Pnr8ZP+V721bGthoy8d+srFae/tL7j94uJu3toXsfPPd9+1/3rl7r83kKDe8Lq67D199NNvQFlrcyz9K1i3KE7BuSy9Yk1pBcb9x89Z+iRxoYHlts3Tyj+jzZsETVre3SWhtKX1uSfsPvvjydmufB+a2fPinObO1ty7eyvrwRSztM2pV/syfuKz17kfdNjBPd5+tuP/qvU8Vd5YiyhOwbor7ASso7oZ/gqMeh9Iq+Gl7R/tTl76KtXz4p2m1+7QCvfvOc/LPbeX75B/dunufXx0vdez9vu2LzdSR5nyqzP+d/falHe9gYmpRnoB1U9wP2Gxz3fjwhzekp8+en/l08P33E5UP/wStI57Qm0/+zjNkGmf7BGdzwgDbV5pJI81Z3H+49tEoxf3PVz8u/yhZtyhPwLop7gdstrlufPgDd4oRr9defFFR+fCPddpzM6fYbE5739PU7XYsp30zmXR0cxb3sZa5uzOVqUV5AtZNcT9gs811y8O/ev2zgTvFnbv3xv25u5Uz5TNwbOxjb+Rt3Xq640n7KnXCwvdFPCDy5EfjT9fd5yzuV8Z4eepfPvDaVCYX5QlYN8X9gG02140Pf3gXmWKnGPfLwAzap39UiZzh9aXtu8Sxq97bd4n+F8yc806ribr7zMX9V+99es5K939c/+D9n7nczuSiPAHrprgfsM3muvHhz9xFFq1V8GNb+2z9+Nju3v9XpjNfRjtFd59/Z/nTL05cMNMa/+fvfVL+IbIFUZ6AdVPcD9hmc9348BX34Y4qx/PfBnpsd+/8CTNnFvcpunvJzvL11Y+Pve6utTOnKE/AuinuB2yzuW58+MNvtdzmTvHGUZfbqx68eNR6987vUj2/uI8+xqpvua2F//dHQ9e7//jhNTekMqcoT8C66SgHbLO5Gv7AneLR4yflUQsddT276gBy9fpnRz1npueL7qMU93G7e+2vp76++vE/Dl56b+X+aw9/ZHZRnoB16/y8W2uzzXXjwx9e9WZ7t3xvhj9753X18vHh5bLzjXms4j5id+9hXdnn731y5/3rP1z76McPr+20f/7z1Y+tjaFKlCdg3RT3AzbbXDc+/EtfaKq7XzT8jUsvXr4qf2DL8F8OtO9s5XP7LiMW97G6ew/FHXoT5QlYN8X9gM02140P/9j3gG6wuw9fO97D5By1YKbbZ7qPW9xH6e6KO+yL8gSsm+J+wGab68aHf+xTDl//tN695+XRVfPz4uWr8rQ7w5833+0tqqMX9/MHq7jDvihPwLop7gdstrka/gkl6a9/+3ubivJlITMY/huJHi637wxflN/Pl423TFHcz+zuijvsi/IErJvifsCWm+vGh3/UHY1v1fc7d++t++r7wHsAelsvPnyl+69/84fytPsmKu6vz3jEvuIO+6I8AeumuB+w5eZq+Efdorqv1cQ++9/5Bq4X723NyRdf3h742fXzi4KLBu6P7XvjUU+vP6e7K+6wL8oTsG6K+wEbb64bH/6xjwC/VJvDbm92PM3wBe4dDnzgB1r7/Mp3Gb4/tk13nu6uuMO+KE/AuinuB2y8uW58+FeOeYvqYS9evlrN8vfhXa3D8Q78LUrb8suj7jtqf5ynuyvusC/KE7BuivsBG2+uGx/+zle3vx2lu79ey92rAx/P0ipgedSTw/e2On/n2P1xhu6uuMO+KE/AuinuB2y8uW58+G+M2N137j94uNy7Vwd2394WuO8sumiesD9O3d0XPZ8wkShPwLoNPOwq7htsrhsf/kVt+z9/vftFy736vuitYvgC/Q5vLD5t5ift7oo77IvyBKyb4n7AojuK4Y+rdb7Rn8fX6nufDzA5YOAkfPPd9+VRL7XcI97J++N03V1xh31RnoB1W+5pbAYbb64bH/6l2mDHvfT++qdbIRe0cmbgVtHtEWO5R7xz9seJurviDvuiPAHrttzT2Aw23lw3Pvx3mejSe7eXqN+iuHc+8+/aH6fo7oo77IvyBKzbck9jM9h4c9348A9re8To9f3R4yf9r3pX3Duf+QP74+jdXXGHfVGegHVb7mlsBhtvrhsf/hCj1/eTXz4/G8W985lP98f7Dx6OtVkq7rAvyhOwbss9jc1g481148Mfbtz63nl3HzjSDl+burPcI96I++NY3V1xh31RnoB1W+5pbAYbb64bH/6xbty81frQKLeu9tzdF71VtFld7hFv3Jk/obu3bfutp2Qq7rAvyhOwbss9jc1g0R3F8Eu0avjV7W9fvHx1Zndvk18+lkvduXtvSP72n5VH3bfoojn6/nh+d1/0fMJEojwB66a4H7Dx5rrx4Z/piy9vn7l+ps+JHfjm1D6/eHzz3ffLLZpT7I9ndnfFHfZFeQLWTXE/YOPNdePDH8U5y99bQ+rw+e7tC8nA8OVR9w3sqU+fPS+Pum+i/fGc7q64w74oT8C6Ke4HbLy5bnz4Izq5vrdSVR7+La2xDQz/1nroHgxcwvTo8ZPyqPum2x9P7u6KO+yL8gSsm+J+wMab68aHP7qvbn97wq2rHd6lOjB5b6+UGv6Vo89NetL98bTuvuilRzCRKE/AuinuB2y8uW58+FNoLfzR4ydH1aNW98tjv2XghtHbgpOBt9V2e7iben88obsPVz57MJsoT8C6LfpMNrWNN9eND386w69Tvu5y2cbA+1Nfd7ZaZvijfsqjXmqG/XG67l4+ezCbKE/AuinuB2y8uW58+JMa3n07LD3DVzb3s0b/q9vfDszc4TelnXn2x6O2zOVuwzCdKE/AuinuB2y8uW58+FN7+uz5wL2vq+vWO8MX63fyYJzhl9s7XJu0M9v+OPxLjuIO+6I8AeumuB+w8ea68eFPbeBzFfvc+4avqejhAvZRa5M6vBt4Z879cfTuXj57MJsoT8C6Lbc6zGDjzXXjw5/BwL2vwxke/oSWpn1FKYx64+at4b8f6Gdtz76Z98dxu3v57MFsojwB66a4H7Dx5rrx4ZvhUcK//um5gYWXsY96gn7PB7r5t5YRu3v57MFsojwB67aC89l0Ft2rDP9YbSOf+dHji57ho1pdG2lJyOGPgCwMOVDJ1jJWdy+fPZhNlCdg3RT3Axbdqwz/WLuHpcy5WGLpMzz8js+ZJ3bn2NLZ+VGuamsZpbuXzx7MJsoTsG7rOKVNZOm9yvCP8uYph48eP5lnacfA4tvtDA9/LuT83f3Yutn55fYrpfvj+d29fPZgNlGegHVT3A/YWnPd+PAv1tBWqad+COPw1jvzAp6jHLWCfLbufkLR7PCZm6dN9UT745ndvXz2YDZRnoB1U9wP2Fpz3fjw95v0pEMbXnl73vuOembLThv4pL/QOGpd+077I+UzmSrfH8/p7uWzB7OJ8gSs2wqqw3TKz5SGP6dLL4G/ePlqio3/qPdTdvtk8Z2jnpK+07r+FLPavkUc+xuA5umz553P8E4P++PJ3b189mA2UZ6AdVPcD+jhTGn4szmwdqVNxYi7wFGtvdXK8plJPXr85IQyd//BwxHfq9pm9dhr/zv9L5LZ6WR/bNN1wjyXzx7MJsoTsG6K+wGdnCkNfx7povPWob+6/e05V2db6Tn2knDPC9zfaHPSJueE0twq4J27986p7+1Htw/lqOfbXNT+bPnsDdTP/nhCdy+fPZhNlCdg3QYedu8/eNjOB9Mpn4dL9XOmNPwZDL9b9NHjJ61PH1U3v/jy9mmXpUe8Jj2p0y7EXpzSY78UtSltx6Vzfugilra/0dX+eOzHXT57MJsoT8C6nXzOG1f5PFyqqzOl4U/t2Icbvv7pgnGbpdb/2iS0Htn+hotauW///oRV12/M/+zzc5zZ3XeePnu+m88303jlp8Xru39u5f7MKV3o3F7pb3886uMunz2YTZQnYN3OP/+NonweLtXbmdLwJ3VCcZ/aUi63vzFKd5/B4lr7lS73x+Efd/nswWyiPAHrVn4G7fmw3uGZ0vCn01txX+jE9t/dl9jar/S6Pw78uMtnD2YT5QlYt/KTaM+H9T7PlIY/ka6K+yIeJvMuPXf3hbb2Kx3vj0M+7vLZg9lEeQLWrfw82vNhvdszpeFPoZ/i3mrQIp4sfsCNm7dOe87MpBb0DJl9Pe+PaXcvnz2YTZQnYN3KT6U9H9Z7PlMa/uhaVx7lrscztQK0lCeLp/N5/8HD8vncefHy1dJntfP98XB3L589mE2UJ2Ddyk+oPR/WOz9TGv4Uvvnu+8JlHqtp7W988eXt8mUzjx4/WfpvMK4sYX880N3LZw9mE+UJWLfaE2rnh/X+z5SGP4UbN2+VXCpuE76Cfrmv8NL7i5evVvPyuEXsj627X7pEqnz2YDZRnoB1KzmbLuWwvogzpeFPZM76/te//X0Rb0g9xwlvjTWlFy1lf7z0NbrlswezifIErNts59HDyufhUks5Uxr+dFp9v3P33qSLPdrXg8U9r/1kv/3dH097g+xwL16+OvYlrIuwoP1xv7uXR4LZRHkC1m3SM+hw5fNwqQWdKQ1/aq0LtsY5YoNv/bJN3fr65RDti0obe5uBEY8h7aNpX4G++PJ2+egmsqz98a3uXp4HZhPlCVi3dpTvQfk8XGr3fvXUahbRGv4Qbbxt1K1FnVbi2x9sf3xld6CerM3DN999f84SmtYO79y9t+K+/sbi9seL3b08DMwmyhMAcKkbN2+1ntSq564zPXr8pHXQi1qnfFOntrMe5jStxO+66f0HD3ezd/GSfPua9GZW23/T5rxN6TZ/X7Egb7p7eRKYTZQnAAA4wa67l8eA2UR5AgCA0/jFCJsS5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUlGeAAAASEV5AgAAIBXlCQAAgFSUJwAAAFJRngAAAEhFeQIAACAV5QkAAIBUlCcAAABSUZ4AAABIRXkCAAAgFeUJAACAVJQnAAAAUv8PDLgy32PsBbgAAAAASUVORK5CYII=';
const SIG_B64 = 'data:image/png;base64,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';
const BODY_FONT = '"Century Schoolbook","Century","Book Antiqua",Georgia,serif';

export default function OffersClient() {
  const { showToast } = useToast();
  const [letterKind, setLetterKind] = useState<LetterKind>('offer');
  const [empType, setEmpType] = useState<EmpType>('contractor');
  const [rateBasis, setRateBasis] = useState<'monthly' | 'hourly'>('monthly');
  const [payBasis, setPayBasis] = useState<'monthly' | 'weekly' | 'biweekly'>('monthly');
  const [salTitle, setSalTitle] = useState('');
  const [form, setForm] = useState<Form>(EMPTY);
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [dec, setDec] = useState<DecForm>(() => ({ ...DEC_EMPTY, date: fmtLongDate(new Date()) }));
  const [gen, setGen] = useState<GenForm>(() => ({ ...GEN_EMPTY, date: fmtLongDate(new Date()) }));

  function set(k: keyof Form, v: string) { setForm(p => ({ ...p, [k]: v })); }
  function setD(k: keyof DecForm, v: string) { setDec(p => ({ ...p, [k]: v })); }
  function setG<K extends keyof GenForm>(k: K, v: GenForm[K]) { setGen(p => ({ ...p, [k]: v })); }

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Toolbar for the General letter body: wrap the current selection in bold/
  // italic markers, or prefix the selected line(s) with a bullet.
  function applyFmt(kind: 'bold' | 'italic' | 'bullet') {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const val = gen.body;
    let next: string, caret: number;
    if (kind === 'bullet') {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const block = val.slice(lineStart, Math.max(end, start));
      const bulleted = (block || '').split('\n').map(l => /^\s*[•\-]\s/.test(l) ? l : '• ' + l).join('\n');
      next = val.slice(0, lineStart) + bulleted + val.slice(Math.max(end, start));
      caret = lineStart + bulleted.length;
    } else {
      const mark = kind === 'bold' ? '**' : '*';
      const sel = val.slice(start, end) || (kind === 'bold' ? 'bold text' : 'italic text');
      next = val.slice(0, start) + mark + sel + mark + val.slice(end);
      caret = start + mark.length + sel.length + mark.length;
    }
    setG('body', next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'offer',
          employeeType: empType,
          name: form.name,
          email: form.email,
          role: form.role,
          dept: form.dept,
          salary: form.salary,
          startDate: form.startDate,
          location: form.location,
          notes: form.notes,
          rateBasis: empType === 'contractor' ? rateBasis : 'monthly',
          payBasis: empType === 'contractor' ? payBasis : 'monthly',
          salutationTitle: salTitle,
        }),
      });
      const data = await res.json();
      setDraft(data.text ?? data.draft ?? '');
    } catch { showToast('Generation failed'); }
    setGenerating(false);
  }

  function printPdf() {
    const win = window.open('', '_blank');
    if (!win) return;

    function esc(s: string) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // Bold the position, salary and start date wherever they appear in the body.
    const salFmt = form.salary ? `$${Number(form.salary).toLocaleString('en-US')}` : '';
    const startFmt = form.startDate
      ? new Date(form.startDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const boldPhrases = [form.role, salFmt, startFmt].map(p => (p ?? '').trim()).filter(Boolean);
    function boldize(escaped: string) {
      let out = escaped;
      for (const p of boldPhrases) {
        const e = esc(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(e, 'g'), m => `<strong>${m}</strong>`);
      }
      return out;
    }

    const draftClean = draft.replace(/\n{3,}/g, '\n\n');
    const linesArr = draftClean.split('\n');

    // Detect structural markers
    const ccBlockStart = linesArr.findIndex(l => /^\[CC_BLOCK\]/.test(l));
    const ccBlockEnd = linesArr.findIndex(l => /^\[\/CC_BLOCK\]/.test(l));
    const closingIdx = linesArr.findIndex(l => /^very truly yours/i.test(l.trim()));

    // Separate cc block (contractor) from rest
    let ccLines: string[] = [];
    let bodyEnd = closingIdx >= 0 ? closingIdx : linesArr.length;
    if (ccBlockStart >= 0 && ccBlockEnd >= 0) {
      ccLines = linesArr.slice(ccBlockStart + 1, ccBlockEnd).filter(l => !l.startsWith('['));
      bodyEnd = ccBlockStart;
    }

    // Build body HTML
    let bodyHtml = '';
    for (let i = 0; i < bodyEnd; i++) {
      const l = linesArr[i];
      if (l.startsWith('[DATE_CENTERED]')) {
        bodyHtml += `<div style="text-align:center;margin-bottom:11pt">${esc(l.replace('[DATE_CENTERED]',''))}</div>`;
      } else if (/^Via Email$/i.test(l.trim())) {
        bodyHtml += `<div style="text-decoration:underline;font-weight:bold;margin-bottom:6pt">${esc(l)}</div>`;
      } else if (/^\s*Re:\s+/i.test(l)) {
        bodyHtml += `<div style="margin-left:2.5em;margin-bottom:6pt"><span style="font-weight:bold">Re:</span><span style="margin-left:2em;font-weight:bold">${esc(l.replace(/^\s*Re:\s+/i,''))}</span></div>`;
      } else if (l.trim() === '') {
        bodyHtml += `<div style="height:6pt"></div>`;
      } else {
        bodyHtml += `<div style="text-align:justify;margin-bottom:0">${boldize(esc(l))}</div>`;
      }
    }

    // Closing block (right side) — Alex signs; Zack & Catie appear in the cc block.
    const sigInner = `<div>Very truly yours,</div>`
      + `<div style="height:5pt"></div>`
      + `<div><img src="${SIG_B64}" width="148" height="49" style="display:block;margin-bottom:1pt" alt=""/></div>`
      + `<div>Alex Little</div>`
      + `<div>Founding &amp; Managing Partner</div>`;
    const closingHtml = `<div style="display:flex;justify-content:flex-end;margin-top:12pt"><div style="text-align:left">${sigInner}</div></div>`;

    // cc block (left side, below closing)
    const ccHtml = ccLines.length
      ? `<div style="margin-top:2pt">${ccLines.map(l => `<div style="min-height:1em">${esc(l) || '&nbsp;'}</div>`).join('')}</div>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offer Letter – ${esc(form.name)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:letter;margin:0.65in 0.8in 0.55in}
  body{font-family:${BODY_FONT};color:#1a1a2e;font-size:11pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18pt">
  <img src="${LOGO_B64}" width="175" height="58" alt="Litson"/>
  <div style="text-align:right;font-size:8.5pt;color:#333;line-height:1.65;font-family:Arial,sans-serif;margin-top:2pt">
    J. Alex Little<br>615.985.8189<br>alex@litson.co
  </div>
</div>
${bodyHtml}
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:8pt">
  <div style="max-width:55%">${ccHtml}</div>
  ${closingHtml ? closingHtml.replace('display:flex;justify-content:flex-end;margin-top:12pt','display:flex;justify-content:flex-end') : ''}
</div>
<div style="margin-top:16pt;padding-top:5pt;border-top:0.5pt solid #aaa;font-family:Arial,sans-serif;font-size:8pt;color:#888">
  Litson PLLC<br>54 Music Square East, Suite 300<br>Nashville, TN 37203<br>www.litson.co
</div>
<script>
  var imgs=document.images,n=imgs.length,done=0;
  function go(){done++;if(done>=n)window.print();}
  if(!n){window.print();}else{for(var i=0;i<n;i++){if(imgs[i].complete)go();else{imgs[i].onload=go;imgs[i].onerror=go;}}}
</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  }

  function downloadTxt() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([draft], { type: 'text/plain' }));
    a.download = `offer-${form.name.replace(/\s+/g, '-') || 'letter'}.txt`;
    a.click();
  }

  function printDeclination() {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const salutation = dec.salutation.trim() || dec.name.trim();
    const bodyHtml = dec.body.split('\n').map(l =>
      l.trim() === ''
        ? `<div style="height:11pt"></div>`
        : `<div style="text-align:justify;text-indent:0.5in;margin-bottom:0">${esc(l)}</div>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Declination Letter${dec.name ? ' – ' + esc(dec.name) : ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:letter;margin:0.65in 0.8in 0.55in}
  body{font-family:${BODY_FONT};color:#1a1a2e;font-size:11pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18pt">
  <img src="${LOGO_B64}" width="175" height="58" alt="Litson"/>
  <div style="text-align:right;font-size:8.5pt;color:#333;line-height:1.65;font-family:Arial,sans-serif;margin-top:2pt">
    J. Alex Little<br>615.985.8189<br>alex@litson.co
  </div>
</div>
${dec.date ? `<div style="text-align:center;margin-bottom:22pt">${esc(dec.date)}</div>` : ''}
${dec.name ? `<div>${esc(dec.name)}</div>` : ''}
${dec.email ? `<div>${esc(dec.email)}</div>` : ''}
<div style="height:22pt"></div>
${dec.re ? `<div style="margin-left:0.5in;margin-bottom:16pt"><span style="font-weight:bold">Re:</span><span style="margin-left:1.5em;font-weight:bold">${esc(dec.re)}</span></div>` : ''}
<div style="margin-bottom:11pt">Dear ${esc(salutation)},</div>
${bodyHtml}
<div style="height:28pt"></div>
<div style="margin-left:3.4in">
  <div>Sincerely,</div>
  <div><img src="${SIG_B64}" width="148" height="49" style="display:block;margin:2pt 0" alt=""/></div>
  <div style="margin-top:10pt">${esc(dec.signer)}</div>
</div>
<div style="margin-top:16pt;padding-top:5pt;border-top:0.5pt solid #aaa;font-family:Arial,sans-serif;font-size:8pt;color:#888">
  Litson PLLC<br>54 Music Square East, Suite 300<br>Nashville, TN 37203<br>www.litson.co
</div>
<script>
  var imgs=document.images,n=imgs.length,done=0;
  function go(){done++;if(done>=n)window.print();}
  if(!n){window.print();}else{for(var i=0;i<n;i++){if(imgs[i].complete)go();else{imgs[i].onload=go;imgs[i].onerror=go;}}}
</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  }

  function printGeneral() {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Body: blank line = paragraph gap; lines starting with • or - become
    // bullet rows; **bold** / *italic* are honored inline; everything else is a
    // justified paragraph.
    const bodyHtml = gen.body.split('\n').map(l => {
      const t = l.trim();
      if (t === '') return `<div style="height:11pt"></div>`;
      if (/^[•\-]\s*/.test(t)) {
        return `<div style="margin-left:1.5em;text-indent:-1em;margin-bottom:2pt">&bull;&nbsp;${fmtInline(t.replace(/^[•\-]\s*/, ''))}</div>`;
      }
      return `<div style="text-align:justify;margin-bottom:0">${fmtInline(l)}</div>`;
    }).join('');

    const ccLines = gen.cc.split('\n').map(l => l.trim()).filter(Boolean);
    const ccHtml = ccLines.length
      ? `<div style="margin-top:20pt"><span style="font-weight:bold">cc:</span>&nbsp;&nbsp;${ccLines.map(esc).join('<br>')}</div>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Letter${gen.re ? ' – ' + esc(gen.re) : ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:letter;margin:0.65in 0.8in 0.55in}
  body{font-family:${BODY_FONT};color:#1a1a2e;font-size:11pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  img{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18pt">
  <img src="${LOGO_B64}" width="175" height="58" alt="Litson"/>
  <div style="text-align:right;font-size:8.5pt;color:#333;line-height:1.65;font-family:Arial,sans-serif;margin-top:2pt">
    J. Alex Little<br>615.985.8189<br>alex@litson.co
  </div>
</div>
${gen.date ? `<div style="margin-bottom:16pt">${esc(gen.date)}</div>` : ''}
${gen.addressee ? `<div style="margin-bottom:16pt;font-weight:bold">${esc(gen.addressee)}</div>` : ''}
${gen.re ? `<div style="margin-bottom:14pt"><span style="font-weight:bold">RE:</span><span style="margin-left:1em;font-weight:bold">${esc(gen.re)}</span></div>` : ''}
${gen.greeting.trim() ? `<div style="margin-bottom:11pt">${esc(gen.greeting)}</div>` : ''}
${bodyHtml}
<div style="height:22pt"></div>
<div style="display:flex;justify-content:flex-end">
  <div style="text-align:left">
    <div>Very truly yours,</div>
    ${gen.withSig ? `<div><img src="${SIG_B64}" width="148" height="49" style="display:block;margin:3pt 0 1pt" alt=""/></div>` : `<div style="height:24pt"></div>`}
    <div>${esc(gen.signer)}</div>
    ${gen.signerTitle ? `<div>${esc(gen.signerTitle)}</div>` : ''}
  </div>
</div>
${ccHtml}
<div style="margin-top:16pt;padding-top:5pt;border-top:0.5pt solid #aaa;font-family:Arial,sans-serif;font-size:8pt;color:#888">
  Litson PLLC<br>6339 Charlotte Pike, Unit C321<br>Nashville, TN 37209<br>www.litson.co
</div>
<script>
  var imgs=document.images,n=imgs.length,done=0;
  function go(){done++;if(done>=n)window.print();}
  if(!n){window.print();}else{for(var i=0;i<n;i++){if(imgs[i].complete)go();else{imgs[i].onload=go;imgs[i].onerror=go;}}}
</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  }

  const ready = !!(form.name && form.role && form.salary);
  const decReady = !!(dec.name && dec.body);
  const genReady = !!gen.body.trim();

  const fields: [string, keyof Form, string][] = [
    ['Candidate Name *', 'name', 'text'],
    ['Email', 'email', 'email'],
    ['Role / Title *', 'role', 'text'],
    ...(empType === 'employee' ? [['Department', 'dept', 'text'] as [string, keyof Form, string]] : []),
    [empType === 'contractor' ? (rateBasis === 'hourly' ? 'Hourly Rate ($) *' : 'Monthly Rate ($) *') : 'Annual Salary ($) *', 'salary', 'text'],
    ['Start Date', 'startDate', 'date'],
    ['Location', 'location', 'text'],
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-8 py-5 bg-white border-b border-border flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-spectral text-[23px] font-semibold text-text-primary">
            {letterKind === 'offer' ? 'Offer Letters' : letterKind === 'declination' ? 'Declination Letters' : 'General Letters'}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {letterKind === 'offer'
              ? 'AI-generated offer letters on Litson letterhead'
              : letterKind === 'declination'
              ? 'Declination-of-representation letters on Litson letterhead'
              : 'Fillable letters on Litson letterhead — sponsorship, proof of employment, references and more'}
          </p>
        </div>
        <div className="flex gap-1 bg-canvas border border-border rounded-ctrl p-1 flex-shrink-0">
          <button onClick={() => setLetterKind('offer')}
            className={clsx('px-4 py-1.5 text-sm font-semibold rounded-ctrl transition-colors',
              letterKind === 'offer' ? 'bg-ink text-white' : 'text-text-secondary hover:text-text-primary')}>
            Offer
          </button>
          <button onClick={() => setLetterKind('declination')}
            className={clsx('px-4 py-1.5 text-sm font-semibold rounded-ctrl transition-colors',
              letterKind === 'declination' ? 'bg-ink text-white' : 'text-text-secondary hover:text-text-primary')}>
            Declination
          </button>
          <button onClick={() => setLetterKind('general')}
            className={clsx('px-4 py-1.5 text-sm font-semibold rounded-ctrl transition-colors',
              letterKind === 'general' ? 'bg-ink text-white' : 'text-text-secondary hover:text-text-primary')}>
            General
          </button>
        </div>
      </header>

      {letterKind === 'offer' && (
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[360px_1fr] gap-6 max-w-5xl items-start">

          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4 sticky top-0">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Letter Type</div>
              <div className="flex gap-2">
                <button onClick={() => setEmpType('contractor')}
                  className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                    empType === 'contractor' ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                  1099 Contractor
                </button>
                <button onClick={() => setEmpType('employee')}
                  className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                    empType === 'employee' ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                  W-2 Employee
                </button>
              </div>
            </div>

            {empType === 'contractor' && (
              <>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Compensation</div>
                  <div className="flex gap-2">
                    {([['monthly', 'Monthly'], ['hourly', 'Hourly']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setRateBasis(val)}
                        className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                          rateBasis === val ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-gold-muted mb-2">Payable Basis</div>
                  <div className="flex gap-2">
                    {([['monthly', 'Monthly'], ['weekly', 'Weekly'], ['biweekly', 'Bi-weekly']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => setPayBasis(val)}
                        className={clsx('flex-1 py-2 text-sm font-semibold rounded-ctrl border transition-colors',
                          payBasis === val ? 'bg-ink text-white border-ink' : 'bg-white text-text-secondary border-border hover:border-ink')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted pt-1">Candidate Details</div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Salutation</label>
              <select value={salTitle} onChange={e => setSalTitle(e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink">
                <option value="">First name (Dear [First],)</option>
                {['Mr.', 'Ms.', 'Mrs.', 'Mx.', 'Dr.'].map(t => <option key={t} value={t}>{t} [Last name]</option>)}
              </select>
            </div>

            {fields.map(([label, key, type]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder={key === 'location' ? (empType === 'contractor' ? 'Remote' : 'Nashville, TN') : ''}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink"
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Additional Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
            </div>

            <EditGate fallback={
              <p className="text-xs text-text-muted text-center py-2">View only — contact HR Admin to generate letters</p>
            }>
              <button onClick={generate} disabled={!ready || generating}
                className="w-full bg-ink text-white text-sm font-semibold py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                {generating ? 'Generating…' : `Generate ${empType === 'contractor' ? 'Contractor' : 'Employee'} Letter`}
              </button>
            </EditGate>
          </div>

          {/* Letter preview panel */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
              {/* Letterhead */}
              <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#e8e2d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_B64} alt="Litson" width={200} height={67} className="block" />
                <div className="text-right text-[10px] text-text-muted leading-[1.8] font-sans mt-1">
                  <span className="font-semibold text-[10.5px] text-text-primary">J. Alex Little</span><br />
                  Managing Member<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              {draft ? (
                <div className="px-8 pt-6 pb-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full text-[13px] leading-[1.6] text-text-primary resize-none focus:outline-none border-none bg-transparent"
                    style={{ fontFamily: BODY_FONT, minHeight: '440px' }}
                  />
                </div>
              ) : (
                <div className="px-8 py-20 text-center">
                  <div className="text-text-muted text-sm italic">Fill in the form and click Generate to create the letter</div>
                </div>
              )}

              {/* Closing block — right-aligned with signature */}
              {draft && /very truly yours/i.test(draft) && (
                <div className="px-8 pb-5 flex justify-end">
                  <div className="text-left">
                    <p className="text-[13px] mb-1" style={{ fontFamily: BODY_FONT }}>Very truly yours,</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SIG_B64} alt="Alex Little signature" width={130} height={43} className="block my-0.5" />
                    <p className="text-[13px] leading-snug" style={{ fontFamily: BODY_FONT }}>
                      Alex Little<br />Founding &amp; Managing Partner<br />Litson PLLC
                    </p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#ccc]">
                <p className="text-[9px] text-text-muted font-sans tracking-wide">
                  Litson PLLC &nbsp;&middot;&nbsp; 6339 Charlotte Pike, Unit C321 &nbsp;&middot;&nbsp; Nashville, TN 37209 &nbsp;&middot;&nbsp; www.litson.co
                </p>
              </div>
            </div>

            {draft && (
              <div className="flex items-center gap-2">
                <button onClick={printPdf}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors">
                  ⤓ Print / PDF
                </button>
                <button onClick={downloadTxt}
                  className="bg-white border border-border text-text-primary text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-canvas transition-colors">
                  ↓ TXT
                </button>
                <button onClick={() => { setDraft(''); setForm(EMPTY); }}
                  className="ml-auto text-sm font-semibold text-text-muted hover:text-text-primary px-3 py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {letterKind === 'declination' && (
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[360px_1fr] gap-6 max-w-5xl items-start">

          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4 sticky top-0">
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted">Recipient</div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Date</label>
              <input type="text" value={dec.date} onChange={e => setD('date', e.target.value)}
                placeholder="July 13, 2026"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Recipient Name *</label>
              <input type="text" value={dec.name} onChange={e => setD('name', e.target.value)}
                placeholder="Eugene Trussell"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
              <input type="email" value={dec.email} onChange={e => setD('email', e.target.value)}
                placeholder="name@example.com"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Salutation</label>
              <input type="text" value={dec.salutation} onChange={e => setD('salutation', e.target.value)}
                placeholder="Mr. Trussell (defaults to name)"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Re:</label>
              <input type="text" value={dec.re} onChange={e => setD('re', e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Signed by</label>
              <input type="text" value={dec.signer} onChange={e => setD('signer', e.target.value)}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>

            <button onClick={() => setDec({ ...DEC_EMPTY, date: fmtLongDate(new Date()) })}
              className="w-full text-sm font-semibold text-text-muted hover:text-text-primary py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
              Reset to template
            </button>
          </div>

          {/* Letter preview panel */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
              {/* Letterhead */}
              <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#e8e2d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_B64} alt="Litson" width={200} height={67} className="block" />
                <div className="text-right text-[10px] text-text-muted leading-[1.8] font-sans mt-1">
                  <span className="font-semibold text-[10.5px] text-text-primary">J. Alex Little</span><br />
                  Managing Member<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              <div className="px-8 pt-6 pb-2 text-[13px] leading-[1.6] text-text-primary" style={{ fontFamily: BODY_FONT }}>
                <p className="text-center mb-5">{dec.date || 'July 13, 2026'}</p>
                <p>{dec.name || 'Recipient Name'}</p>
                {dec.email && <p>{dec.email}</p>}
                <p className="mt-5 mb-4" style={{ marginLeft: '2.5em' }}><span className="font-bold">Re:</span><span className="font-bold ml-6">{dec.re}</span></p>
                <p className="mb-3">Dear {dec.salutation.trim() || dec.name.trim() || 'Recipient'},</p>
                <textarea value={dec.body} onChange={e => setD('body', e.target.value)}
                  className="w-full resize-none focus:outline-none border border-transparent hover:border-border-light focus:border-ink rounded-ctrl bg-transparent text-[13px] leading-[1.6] px-1 py-1"
                  style={{ fontFamily: BODY_FONT, minHeight: '150px', textIndent: '2.5em', textAlign: 'justify' }} />
              </div>

              {/* Closing + signature — indented to the right, matching house style */}
              <div className="px-8 pb-5">
                <div style={{ marginLeft: '52%' }}>
                  <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>Sincerely,</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={SIG_B64} alt="signature" width={130} height={43} className="block my-1" />
                  <p className="text-[13px] mt-2" style={{ fontFamily: BODY_FONT }}>{dec.signer}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#ccc]">
                <p className="text-[9px] text-text-muted font-sans tracking-wide">
                  Litson PLLC &nbsp;&middot;&nbsp; 6339 Charlotte Pike, Unit C321 &nbsp;&middot;&nbsp; Nashville, TN 37209 &nbsp;&middot;&nbsp; www.litson.co
                </p>
              </div>
            </div>

            <EditGate fallback={
              <p className="text-xs text-text-muted py-2">View only — contact HR Admin to print letters</p>
            }>
              <div className="flex items-center gap-2">
                <button onClick={printDeclination} disabled={!decReady}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                  ⤓ Print / PDF
                </button>
              </div>
            </EditGate>
          </div>
        </div>
      </div>
      )}

      {letterKind === 'general' && (
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-[360px_1fr] gap-6 max-w-5xl items-start">

          {/* Form panel */}
          <div className="bg-white border border-border rounded-card p-6 space-y-4 sticky top-0">
            <div className="text-xs font-bold uppercase tracking-wider text-gold-muted">Letter Details</div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Date</label>
              <input type="text" value={gen.date} onChange={e => setG('date', e.target.value)}
                placeholder="July 23, 2026"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Addressee</label>
              <input type="text" value={gen.addressee} onChange={e => setG('addressee', e.target.value)}
                placeholder="To Whom It May Concern:"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Re: (subject)</label>
              <input type="text" value={gen.re} onChange={e => setG('re', e.target.value)}
                placeholder="Financial Sponsorship Letter for …"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Greeting <span className="text-text-muted font-normal">(optional)</span></label>
              <input type="text" value={gen.greeting} onChange={e => setG('greeting', e.target.value)}
                placeholder="Dear Sir or Madam,"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Body *</label>
              <div className="flex items-center gap-1 mb-1.5">
                <button type="button" onClick={() => applyFmt('bold')} title="Bold selected text (**text**)"
                  className="px-2.5 py-1 text-sm font-bold rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">B</button>
                <button type="button" onClick={() => applyFmt('italic')} title="Italicize selected text (*text*)"
                  className="px-2.5 py-1 text-sm italic rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">I</button>
                <button type="button" onClick={() => applyFmt('bullet')} title="Turn the current line(s) into bullets"
                  className="px-2.5 py-1 text-sm rounded-ctrl border border-border-light text-text-secondary hover:border-ink hover:text-text-primary transition-colors">• List</button>
              </div>
              <textarea ref={bodyRef} value={gen.body} onChange={e => setG('body', e.target.value)} rows={9}
                placeholder={"Type the letter here. Leave a blank line between paragraphs.\n\nSelect text and use B / I above, or type **bold** and *italic*.\nStart a line with • or - for a bullet point."}
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-y" />
              <p className="text-[11px] text-text-muted mt-1">Blank line = new paragraph. <code>**bold**</code>, <code>*italic*</code>, and lines starting with • or - become bullets.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Signed by</label>
                <input type="text" value={gen.signer} onChange={e => setG('signer', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Title</label>
                <input type="text" value={gen.signerTitle} onChange={e => setG('signerTitle', e.target.value)}
                  className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">cc <span className="text-text-muted font-normal">(optional, one per line)</span></label>
              <textarea value={gen.cc} onChange={e => setG('cc', e.target.value)} rows={2}
                placeholder="Zack Lawson, Member"
                className="w-full border border-border-light rounded-ctrl px-3 py-2 text-sm focus:outline-none focus:border-ink resize-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={gen.withSig} onChange={e => setG('withSig', e.target.checked)} />
              Include Alex Little&rsquo;s signature image
            </label>

            <button onClick={() => setGen({ ...GEN_EMPTY, date: fmtLongDate(new Date()) })}
              className="w-full text-sm font-semibold text-text-muted hover:text-text-primary py-2 rounded-ctrl hover:bg-canvas border border-transparent hover:border-border transition-colors">
              Reset
            </button>
          </div>

          {/* Letter preview panel */}
          <div className="space-y-3">
            <div className="bg-white border border-border rounded-card overflow-hidden shadow-sm">
              {/* Letterhead */}
              <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-[#e8e2d8]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGO_B64} alt="Litson" width={200} height={67} className="block" />
                <div className="text-right text-[10px] text-text-muted leading-[1.8] font-sans mt-1">
                  <span className="font-semibold text-[10.5px] text-text-primary">J. Alex Little</span><br />
                  Managing Member<br />615.985.8189<br />alex@litson.co
                </div>
              </div>

              {/* Body */}
              <div className="px-8 pt-6 pb-2 text-[13px] leading-[1.6] text-text-primary" style={{ fontFamily: BODY_FONT }}>
                {gen.date && <p className="mb-4">{gen.date}</p>}
                {gen.addressee && <p className="mb-4 font-bold">{gen.addressee}</p>}
                {gen.re && <p className="mb-4"><span className="font-bold">RE:</span><span className="font-bold ml-3">{gen.re}</span></p>}
                {gen.greeting.trim() && <p className="mb-3">{gen.greeting}</p>}
                {gen.body.trim()
                  ? gen.body.split('\n').map((l, i) => {
                      const t = l.trim();
                      if (t === '') return <div key={i} style={{ height: '11px' }} />;
                      if (/^[•\-]\s*/.test(t)) return <p key={i} className="mb-1" style={{ marginLeft: '1.5em', textIndent: '-1em' }} dangerouslySetInnerHTML={{ __html: '&bull;&nbsp;' + fmtInline(t.replace(/^[•\-]\s*/, '')) }} />;
                      return <p key={i} style={{ textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: fmtInline(l) }} />;
                    })
                  : <p className="text-text-muted italic">Type the letter body in the form…</p>}
              </div>

              {/* Closing + signature */}
              <div className="px-8 pb-5 flex justify-end">
                <div className="text-left">
                  <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>Very truly yours,</p>
                  {gen.withSig
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={SIG_B64} alt="signature" width={130} height={43} className="block my-1" />
                    : <div style={{ height: '28px' }} />}
                  <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>{gen.signer}</p>
                  {gen.signerTitle && <p className="text-[13px]" style={{ fontFamily: BODY_FONT }}>{gen.signerTitle}</p>}
                </div>
              </div>

              {gen.cc.trim() && (
                <div className="px-8 pb-4 text-[13px]" style={{ fontFamily: BODY_FONT }}>
                  <span className="font-bold">cc:</span>{' '}
                  {gen.cc.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => (
                    <span key={i}>{i > 0 && <br />}{l}</span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="px-8 pt-3 pb-5 border-t border-[#ccc]">
                <p className="text-[9px] text-text-muted font-sans tracking-wide">
                  Litson PLLC &nbsp;&middot;&nbsp; 6339 Charlotte Pike, Unit C321 &nbsp;&middot;&nbsp; Nashville, TN 37209 &nbsp;&middot;&nbsp; www.litson.co
                </p>
              </div>
            </div>

            <EditGate fallback={
              <p className="text-xs text-text-muted py-2">View only — contact HR Admin to print letters</p>
            }>
              <div className="flex items-center gap-2">
                <button onClick={printGeneral} disabled={!genReady}
                  className="bg-ink text-white text-sm font-semibold px-4 py-2.5 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-40">
                  ⤓ Print / PDF
                </button>
              </div>
            </EditGate>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
