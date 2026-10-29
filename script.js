/* CAMEX REAL 3D LOADER — Three.js/WebGL scene */
(() => {
  'use strict';

  const init = () => {
    const root = document.getElementById('camex-loader');
    const canvas = document.getElementById('camex-3d-canvas');
    const fill = document.getElementById('loader-progress-fill');
    if (!root || !canvas || root.dataset.threeLoaderStarted === 'true') return;
    root.dataset.threeLoaderStarted = 'true';

    // Pause the homepage hero while the full-screen WebGL intro and transition are active.
    const introHeroVideo = document.getElementById('hero-video');
    if (introHeroVideo) introHeroVideo.pause();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startTime = performance.now();
    // Keep the full visual story even when the OS requests reduced motion.
    // Reduced motion still disables handheld drift and shortens CSS transitions,
    // but must not skip the aisle or the required video handoff.
    const minimumDuration = 8600;
    const failSafeDuration = 18000;
    let finished = false;
    let frameId = 0;
    let renderer, scene, camera;
    let trails = [];
    let shelfGroups = [];
    let floorGrid;
    let ceilingGroupRef;
    let dust;
    let rendererReady = false;
    let fallbackStarted = false;

    // Independent progress recovery: if a later script throws before the model
    // status controller boots, never leave the cinematic loader frozen at 03%.
    // The normal model controller updates this same label first when healthy.
    let rescueProgressTimer = null;
    window.setTimeout(() => {
      const percentEl = document.getElementById('camex-model-load-percent');
      const labelEl = document.getElementById('camex-model-load-label');
      if (finished || !root.isConnected || !percentEl || percentEl.textContent.trim() !== '03%') return;
      let rescuePercent = 3;
      if (labelEl) labelEl.textContent = 'STARTING DETECTION ENGINE';
      rescueProgressTimer = window.setInterval(() => {
        if (finished || !root.isConnected) {
          window.clearInterval(rescueProgressTimer);
          return;
        }
        const currentStatus = root.dataset.camexModelStatus;
        if (currentStatus === 'ready' || currentStatus === 'offline' || currentStatus === 'timeout') {
          window.clearInterval(rescueProgressTimer);
          return;
        }
        // If the main model controller starts updating, let it own the display.
        const visible = document.getElementById('camex-model-load-percent');
        if (visible && visible.textContent.trim() !== `${String(Math.round(rescuePercent)).padStart(2, '0')}%`) {
          window.clearInterval(rescueProgressTimer);
          return;
        }
        rescuePercent = Math.min(92, rescuePercent + 1.1);
        if (visible) visible.textContent = `${String(Math.round(rescuePercent)).padStart(2, '0')}%`;
        if (labelEl && rescuePercent >= 58) labelEl.textContent = 'PREPARING DETECTION ENGINE';
      }, 220);
    }, 1400);

    function buildFallback() {
      if (fallbackStarted || finished) return;
      fallbackStarted = true;
      // Independent 2D canvas: WebGL may already have claimed the Three.js canvas.
      root.classList.add('camex-3d-fallback');
      const fallbackCanvas = document.getElementById('camex-fallback-canvas');
      if (!fallbackCanvas) return;
      const ctx = fallbackCanvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let w = 0, h = 0, t0 = performance.now();
      const resize2d = () => {
        w = root.clientWidth; h = root.clientHeight;
        fallbackCanvas.width = Math.floor(w*dpr); fallbackCanvas.height = Math.floor(h*dpr);
        fallbackCanvas.style.width = w+'px'; fallbackCanvas.style.height = h+'px';
      };
      resize2d();
      const draw = (now) => {
        if (finished || !fallbackCanvas.isConnected) return;
        const elapsed = (now-t0)/1000;
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.clearRect(0,0,w,h);
        const cx=w*.5, horizon=h*(.43 - .025*Math.min(1,elapsed/7)), floorY=h*1.02;
        const ease = v => { v=Math.max(0,Math.min(1,v)); return v*v*(3-2*v); };
        const move = ease((elapsed-1.2)/5.4);
        // Atmospheric aisle depth and vanishing point.
        const bg=ctx.createLinearGradient(0,0,0,h);
        bg.addColorStop(0,'#03060b'); bg.addColorStop(.48,'#070c14'); bg.addColorStop(1,'#020407');
        ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
        const glow=ctx.createRadialGradient(cx,horizon,2,cx,horizon,Math.max(w,h)*.5);
        glow.addColorStop(0,'rgba(66,125,164,.16)'); glow.addColorStop(.5,'rgba(26,50,76,.07)'); glow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);
        // Perspective floor grid converging down the aisle.
        ctx.lineWidth=1; ctx.strokeStyle='rgba(77,130,173,.13)';
        for(let i=-8;i<=8;i++) { ctx.beginPath(); ctx.moveTo(cx+i*2,horizon); ctx.lineTo(cx+i*w*.095,floorY); ctx.stroke(); }
        for(let j=1;j<=13;j++) { const f=j/13; const y=horizon+(floorY-horizon)*Math.pow(f,1.75); ctx.globalAlpha=.12+f*.18; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
        ctx.globalAlpha=1;
        // Shelf racks on both sides grow toward camera to imply a forward dolly.
        const rackShift=move*0.07;
        [-1,1].forEach(side=>{
          for(let row=0;row<5;row++) {
            const depth=(row+1)/5;
            const yTop=horizon+(h-horizon)*(depth*.73)+rackShift*h;
            const xVan=cx+side*w*(.055+depth*.035);
            const xOuter=cx+side*w*(.18+depth*.29);
            const shelfH=h*(.012+depth*.035);
            ctx.fillStyle=side<0?'rgba(15,27,41,.94)':'rgba(13,24,36,.94)';
            ctx.beginPath(); ctx.moveTo(xVan,yTop); ctx.lineTo(xOuter,yTop-shelfH*.7); ctx.lineTo(xOuter,yTop+shelfH*2.4); ctx.lineTo(xVan,yTop+shelfH); ctx.closePath(); ctx.fill();
            ctx.strokeStyle='rgba(103,137,164,.34)'; ctx.lineWidth=1+depth;
            ctx.beginPath(); ctx.moveTo(xVan,yTop); ctx.lineTo(xOuter,yTop-shelfH*.7); ctx.lineTo(xOuter,yTop+shelfH*2.4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xVan,yTop+shelfH); ctx.lineTo(xOuter,yTop+shelfH*.35); ctx.stroke();
            // Muted package silhouettes keep the fallback grounded without looking like UI cards.
            for(let box=0;box<4;box++) {
              const bx=xVan+(xOuter-xVan)*(.18+box*.19), by=yTop-shelfH*.2;
              const bw=Math.max(3,w*(.003+depth*.009)), bh=Math.max(5,h*(.008+depth*.018));
              ctx.fillStyle=['rgba(65,91,112,.75)','rgba(44,76,68,.8)','rgba(84,60,67,.72)','rgba(56,68,92,.8)'][(row+box)%4];
              ctx.fillRect(bx,by-bh,bw,bh);
              ctx.fillStyle='rgba(218,231,240,.18)'; ctx.fillRect(bx,by-bh,bw,1);
            }
          }
        });
        // Flowing signal trails move into the aisle's vanishing point.
        const colors=['#ff6a2c','#ff982d','#e7b84e','#f1e8d6','#6d9fbd','#647dff','#b84d4c','#548f9b'];
        for(let i=0;i<colors.length;i++) {
          const side=i<4?-1:1, lane=i%4;
          const phase=((elapsed*.42+i*.17)%1);
          const x1=cx+side*w*(.13+lane*.035), y1=h*(.91-lane*.015);
          const x2=cx+side*w*(.018+lane*.009), y2=horizon+(h*.12)*(1-phase*.18);
          const grad=ctx.createLinearGradient(x1,y1,x2,y2);
          grad.addColorStop(0,'rgba(0,0,0,0)'); grad.addColorStop(.48,colors[i]); grad.addColorStop(1,'rgba(255,255,255,.95)');
          ctx.strokeStyle=grad; ctx.lineWidth=1.1+lane*.28; ctx.globalAlpha=.48+.38*Math.abs(Math.sin(elapsed*1.6+i));
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx+side*w*.08,h*.58,x2,y2); ctx.stroke();
        }
        ctx.globalAlpha=1;
        frameId=requestAnimationFrame(draw);
      };
      draw(t0);
      window.addEventListener('resize',resize2d,{passive:true});
    }

    function initThree() {
      if (!window.THREE) throw new Error('Three.js did not load');
      const THREE = window.THREE;
      renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      renderer.setSize(root.clientWidth, root.clientHeight, false);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.setClearColor(0x030509, 1);
      // Keep the intro GPU-light: the aisle has emissive materials and does not need realtime shadows.
      renderer.shadowMap.enabled = false;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.50;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else renderer.outputEncoding = THREE.sRGBEncoding;
      rendererReady = true;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x030509);
      scene.fog = new THREE.FogExp2(0x030509, 0.027);
      camera = new THREE.PerspectiveCamera(52, root.clientWidth/root.clientHeight, .1, 120);
      camera.position.set(0, 3.2, 10.5);
      camera.lookAt(0, 1.2, -4);

      scene.add(new THREE.HemisphereLight(0x344258, 0x010204, .20));
      scene.add(new THREE.AmbientLight(0x455166, .12));
      const keyLight = new THREE.PointLight(0x25466e, 1.05, 28);
      keyLight.position.set(0, 5, -5); scene.add(keyLight);
      const warmLight = new THREE.PointLight(0x77391f, 1.15, 22);
      warmLight.position.set(-5, 2, -8); scene.add(warmLight);
      const greenLight = new THREE.PointLight(0x1c5744, .38, 18);
      greenLight.position.set(5, 2, -11); scene.add(greenLight);

      // Floor and real perspective grid.
      const floorMat = new THREE.MeshStandardMaterial({ color:0x030509, roughness:.88, metalness:.015, emissive:0x000000 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(90,100), floorMat);
      floor.rotation.x=-Math.PI/2; floor.position.set(0,-.08,-20); scene.add(floor);
      floorGrid = new THREE.GridHelper(90, 90, 0x0b1a2a, 0x070e17);
      floorGrid.position.set(0, .005, -18);
      floorGrid.material.transparent = true;
      floorGrid.material.opacity = .055;
      floorGrid.material.depthWrite = false;
      scene.add(floorGrid);

      // Central vanishing-point marker.
      const target = new THREE.Group();
      target.position.set(0, .16, -8);
      const center = new THREE.Mesh(new THREE.SphereGeometry(.026,10,10), new THREE.MeshBasicMaterial({color:0x8db6d7, transparent:true, opacity:.55}));
      target.add(center); scene.add(target);

      // Curved glowing line paths on the floor. Draw range moves continuously.
      const colorList = [0xff6a2c,0xff982d,0xe7b84e,0xf1e8d6,0x6d9fbd,0x647dff,0xb84d4c,0xc47b31,0x548f9b,0xd15b35];
      for (let i=0;i<colorList.length;i++) {
        const side = i<5 ? -1 : 1;
        const lane = i%5;
        const x0 = side*(2.1 + lane*.64);
        const xMid = side*(.9 + lane*.19);
        const points = [
          new THREE.Vector3(x0, .035, 8.5),
          new THREE.Vector3(x0*.88, .045, 4.0),
          new THREE.Vector3(xMid*1.6, .06, -.5),
          new THREE.Vector3(xMid*.7, .09, -4.5),
          new THREE.Vector3(side*.06, .13, -7.6)
        ];
        const curve = new THREE.CatmullRomCurve3(points);
        const radialSegments = 5;
        const geometry = new THREE.TubeGeometry(curve, 180, .018 + (i%3)*.003, radialSegments, false);
        const material = new THREE.MeshBasicMaterial({
          color:colorList[i], transparent:true, opacity:.96,
          blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false
        });
        const line = new THREE.Mesh(geometry, material);
        line.geometry.setDrawRange(0,0);
        scene.add(line);

        // Broad, dimmer outer tube supplies a cinematic bloom-like halo without washing out the floor.
        const glowGeometry = new THREE.TubeGeometry(curve, 180, .105 + (i%2)*.018, 6, false);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color:colorList[i], transparent:true, opacity:.075,
          blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.geometry.setDrawRange(0,0);
        scene.add(glow);
        trails.push({line, glow, curve, offset:i*.105, length:0.25+(i%3)*.07, color:colorList[i], radialSegments});
        // Small glowing head, tinted to match the trail rather than white-hot.
        const bead = new THREE.Mesh(new THREE.SphereGeometry(.026,10,10), new THREE.MeshBasicMaterial({color:colorList[i], toneMapped:false}));
        scene.add(bead);
        trails[trails.length-1].bead=bead;
      }

      // Real 3D shelf/rack geometry, hidden until the camera enters the store.
      const rackMat = new THREE.MeshStandardMaterial({color:0x0b1017,metalness:.55,roughness:.58,emissive:0x010203});
      const shelfMat = new THREE.MeshStandardMaterial({color:0x151c25,metalness:.52,roughness:.52,emissive:0x010203});
      const boxMats = [
        new THREE.MeshStandardMaterial({color:0x30283e,emissive:0x030205,roughness:.72}),
        new THREE.MeshStandardMaterial({color:0x1e463b,emissive:0x020403,roughness:.72}),
        new THREE.MeshStandardMaterial({color:0x482a32,emissive:0x030203,roughness:.74}),
        new THREE.MeshStandardMaterial({color:0x303d54,emissive:0x020305,roughness:.72})
      ];
      // Procedural printed packaging: restrained labels and satin finishes instead of blank toy-like cubes.
      function makePackageTexture(base, accent, word) {
        const c = document.createElement('canvas'); c.width = 128; c.height = 192;
        const x = c.getContext('2d');
        const g = x.createLinearGradient(0,0,128,0);
        g.addColorStop(0,'#111722'); g.addColorStop(.28,base); g.addColorStop(.78,base); g.addColorStop(1,'#151b25');
        x.fillStyle=g; x.fillRect(0,0,128,192);
        x.fillStyle=accent; x.fillRect(0,16,128,6);
        x.fillStyle='rgba(255,255,255,.86)'; x.font='bold 12px Arial'; x.fillText(word,9,43);
        x.fillStyle='rgba(255,255,255,.35)'; x.fillRect(9,52,78,2); x.fillRect(9,59,54,2);
        x.strokeStyle='rgba(255,255,255,.24)'; x.strokeRect(9,72,110,90);
        x.fillStyle=accent; x.globalAlpha=.82; x.beginPath(); x.arc(64,116,24,0,Math.PI*2); x.fill(); x.globalAlpha=1;
        x.fillStyle='rgba(8,12,18,.7)'; x.beginPath(); x.arc(64,116,15,0,Math.PI*2); x.fill();
        for(let i=0;i<6;i++){x.fillStyle='rgba(255,255,255,.26)';x.fillRect(9,173+i*2,26+i*10,1);}
        const tex=new THREE.CanvasTexture(c); if ('colorSpace' in tex) tex.colorSpace=THREE.SRGBColorSpace; else tex.encoding=THREE.sRGBEncoding;
        return tex;
      }
      const printedMats = [
        new THREE.MeshStandardMaterial({map:makePackageTexture('#283b50','#d99a56','NOVA'),roughness:.62}),
        new THREE.MeshStandardMaterial({map:makePackageTexture('#30443c','#7ab99d','PURE'),roughness:.62}),
        new THREE.MeshStandardMaterial({map:makePackageTexture('#42344c','#b69cdd','ORBIT'),roughness:.6}),
        new THREE.MeshStandardMaterial({map:makePackageTexture('#483238','#d88a83','VITA'),roughness:.63})
      ];
      function addRack(side, z) {
        const group = new THREE.Group();
        group.position.set(side*4.7,0,z);

        // Perforated steel uprights and rear bracing.
        const postGeo = new THREE.BoxGeometry(.085,4.25,.13);
        [-1.18,1.18].forEach(x=>{
          const post=new THREE.Mesh(postGeo,rackMat);
          post.position.set(x,2.12,0); group.add(post);
          for(let hole=0;hole<23;hole++){
            const perforation=new THREE.Mesh(
              new THREE.BoxGeometry(.012,.035,.006),
              new THREE.MeshBasicMaterial({color:0x647286,transparent:true,opacity:.48})
            );
            perforation.position.set(x, .22+hole*.17, .068); group.add(perforation);
          }
        });
        const braceMat = new THREE.MeshStandardMaterial({color:0x303b48,metalness:.68,roughness:.48});
        for(let level=0;level<4;level++){
          const brace1=new THREE.Mesh(new THREE.BoxGeometry(.035,.58,.045),braceMat);
          brace1.position.set(-.55,.82+level*.82,-.12); brace1.rotation.z=.68; group.add(brace1);
          const brace2=new THREE.Mesh(new THREE.BoxGeometry(.035,.58,.045),braceMat);
          brace2.position.set(.55,.82+level*.82,-.12); brace2.rotation.z=-.68; group.add(brace2);
        }

        // Dark back panel adds depth behind products.
        const backPanel=new THREE.Mesh(
          new THREE.BoxGeometry(2.28,3.78,.045),
          new THREE.MeshStandardMaterial({color:0x111923,metalness:.28,roughness:.72})
        );
        backPanel.position.set(0,2.28,-.31); group.add(backPanel);

        for(let level=0;level<5;level++){
          const y=.43+level*.77;
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.42,.075,.78),shelfMat);
          shelf.position.set(0,y,0); group.add(shelf);

          // Folded front lip, underside support and small price rail.
          const lip=new THREE.Mesh(new THREE.BoxGeometry(2.42,.075,.055),
            new THREE.MeshStandardMaterial({color:0x56616f,metalness:.58,roughness:.34}));
          lip.position.set(0,y+.015,.405); group.add(lip);
          const underside=new THREE.Mesh(new THREE.BoxGeometry(2.18,.035,.54),
            new THREE.MeshStandardMaterial({color:0x1b222c,metalness:.45,roughness:.45}));
          underside.position.set(0,y-.06,-.015); group.add(underside);

          const labelRail=new THREE.Mesh(new THREE.BoxGeometry(2.3,.085,.025),
            new THREE.MeshStandardMaterial({color:0x495461,metalness:.25,roughness:.68}));
          labelRail.position.set(0,y-.065,.445); group.add(labelRail);
          for(let tag=0;tag<6;tag++){
            const tagMesh=new THREE.Mesh(new THREE.PlaneGeometry(.27,.048),
              new THREE.MeshBasicMaterial({color:tag%3===0?0xc5b68f:0x9ca7ae,side:THREE.DoubleSide}));
            tagMesh.position.set(-.96+tag*.385,y-.065,.46); group.add(tagMesh);
            const tinyLine=new THREE.Mesh(new THREE.PlaneGeometry(.11,.006),
              new THREE.MeshBasicMaterial({color:0x4d5965,side:THREE.DoubleSide}));
            tinyLine.position.set(-.96+tag*.385,y-.067,.462); group.add(tinyLine);
          }

          // Vary carton sizes and positions to avoid the repeated-cube look.
          for(let b=0;b<4;b++){
            const material=printedMats[(level+b+(side>0?1:0))%printedMats.length];
            const width=[.34,.42,.3,.38][(level+b)%4];
            const height=[.27,.36,.31,.42][(level*2+b)%4];
            const depth=[.32,.38,.29,.34][(level+b*2)%4];
            const box = new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
            box.position.set(-.86+b*.56,y+.045+height/2,.02+(b%2)*.025);
            box.rotation.y=((b%3)-1)*.045;
            group.add(box);

            // Small top flap seam and side accent strip.
            const seam=new THREE.Mesh(new THREE.BoxGeometry(width*.82,.006,depth*.75),
              new THREE.MeshBasicMaterial({color:0xd8dfe8,transparent:true,opacity:.42}));
            seam.position.set(box.position.x,box.position.y+height/2+.004,box.position.z); group.add(seam);
          }

          // A few bottles and tins mixed into the cartons.
          if(level%2===0){
            for(let n=0;n<2;n++){
              const bottleMat=new THREE.MeshStandardMaterial({
                color:n===0?0x285f50:0x344c72,metalness:.12,roughness:.27,
                transparent:true,opacity:.94
              });
              const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.075,.095,.29,14),bottleMat);
              bottle.position.set(-.62+n*1.2,y+.19,.14); group.add(bottle);
              const cap=new THREE.Mesh(new THREE.CylinderGeometry(.043,.043,.045,12),
                new THREE.MeshStandardMaterial({color:0xd4dce4,metalness:.4,roughness:.3}));
              cap.position.set(-.62+n*1.2,y+.36,.14); group.add(cap);
              const band=new THREE.Mesh(new THREE.CylinderGeometry(.078,.078,.055,14),
                new THREE.MeshBasicMaterial({color:n===0?0x438c72:0x547ca2}));
              band.position.set(-.62+n*1.2,y+.18,.14); group.add(band);
            }
          }
        }

        // Colored shelf edge accents and end-cap label.
        const stripColor=side<0?0x59406f:0x286b58;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(2.36,.022,.035),
          new THREE.MeshBasicMaterial({color:stripColor}));
        strip.position.set(0,3.66,.43); group.add(strip);
        const endLabel=new THREE.Mesh(new THREE.BoxGeometry(.48,.19,.035),
          new THREE.MeshStandardMaterial({color:0x171f2a,metalness:.2,roughness:.55}));
        endLabel.position.set(side<0?1.43:-1.43,3.75,.05); group.add(endLabel);
        const labelGlow=new THREE.Mesh(new THREE.BoxGeometry(.31,.018,.012),
          new THREE.MeshBasicMaterial({color:stripColor}));
        labelGlow.position.set(endLabel.position.x,3.76,.074); group.add(labelGlow);

        group.visible=false; scene.add(group); shelfGroups.push(group);
      }
      [-4,-9,-14,-19].forEach(z=>{addRack(-1,z);addRack(1,z);});

      // Overhead retail ceiling: dark cross-beams, recessed rails and linear fixtures.
      const ceilingGroup = new THREE.Group();
      ceilingGroupRef = ceilingGroup;
      const beamMat = new THREE.MeshStandardMaterial({color:0x151d28,metalness:.62,roughness:.42});
      for(let z=-2;z>=-22;z-=4){
        const crossBeam=new THREE.Mesh(new THREE.BoxGeometry(10.8,.13,.16),beamMat);
        crossBeam.position.set(0,5.05,z); ceilingGroup.add(crossBeam);
        for(const side of [-1,1]){
          const sideRail=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,4.1),beamMat);
          sideRail.position.set(side*5.2,4.96,z-1.8); ceilingGroup.add(sideRail);
        }
        // Recessed white strip and warm diffuser.
        const fixture=new THREE.Mesh(new THREE.BoxGeometry(1.25,.035,.28),
          new THREE.MeshBasicMaterial({color:0x34495c, toneMapped:false}));
        fixture.position.set(0,4.96,z); ceilingGroup.add(fixture);
        const warmDiffuser=new THREE.Mesh(new THREE.BoxGeometry(.72,.012,.19),
          new THREE.MeshBasicMaterial({color:0x67462e, toneMapped:false}));
        warmDiffuser.position.set(0,4.935,z); ceilingGroup.add(warmDiffuser);
      }
      ceilingGroup.visible=false;
      scene.add(ceilingGroup);

      // Small illuminated aisle signs suspended above the shelves.
      const signMat=new THREE.MeshStandardMaterial({color:0x101923,metalness:.28,roughness:.48});
      for(let i=0;i<3;i++){
        const sign=new THREE.Group();
        sign.position.set(0,4.65,-6-i*5.2);
        const board=new THREE.Mesh(new THREE.BoxGeometry(1.05,.25,.055),signMat);
        sign.add(board);
        const signLine=new THREE.Mesh(new THREE.BoxGeometry(.48,.014,.01),
          new THREE.MeshBasicMaterial({color:i===1?0x3c9b7d:0x4d80ad}));
        signLine.position.set(0,.025,.035); sign.add(signLine);
        const number=new THREE.Mesh(new THREE.BoxGeometry(.14,.10,.012),
          new THREE.MeshBasicMaterial({color:0x26394a}));
        number.position.set(-.35,-.055,.036); sign.add(number);
        sign.visible=false; scene.add(sign);
        shelfGroups.push(sign);
      }

      // Aisle light pools create grounded illumination without washing out the floor.
      const aisleLights=[];
      [
        [0x263d5a,-1.6,2.8,-5,.72],
        [0x60351f,1.8,2.6,-10,.62],
        [0x342b52,-2.8,2.5,-15,.52],
        [0x194638,2.8,2.5,-17,.46]
      ].forEach(([color,x,y,z,intensity])=>{
        const light=new THREE.PointLight(color,intensity,6,2);
        light.position.set(x,y,z); scene.add(light); aisleLights.push(light);
      });

      // Sparse data particles drifting through the scene.
      const particleCount=260;
      const positions=new Float32Array(particleCount*3);
      for(let i=0;i<particleCount;i++){
        positions[i*3]=(Math.random()-.5)*18;
        positions[i*3+1]=Math.random()*5;
        positions[i*3+2]=-Math.random()*32+5;
      }
      const pGeo=new THREE.BufferGeometry();
      pGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
      dust=new THREE.Points(pGeo,new THREE.PointsMaterial({color:0x6c829d,size:.018,transparent:true,opacity:.24,depthWrite:false}));
      scene.add(dust);
    }

    function resize() {
      if (!rendererReady || !renderer) return;
      const w=Math.max(1,root.clientWidth), h=Math.max(1,root.clientHeight);
      renderer.setSize(w,h,false);
      camera.aspect=w/h; camera.updateProjectionMatrix();
    }

    function updateScene(elapsed) {
      const t=elapsed/1000;
      const ease = v => { v=Math.max(0,Math.min(1,v)); return v*v*(3-2*v); };
      const THREE=window.THREE;
      // Story beats: ambient -> trails -> dolly corridor -> physical retail racks -> UI card.
      // Reveal the physical racks while the camera is still approaching them.
      // Previously they appeared around t=5s, after most of the dolly had happened,
      // so the viewer saw little visual parallax and the movement felt static.
      let rackMix=0;
      if(t>0.65) { const p=Math.min(1,(t-0.65)/2.15); rackMix=p*p*(3-2*p); }
      shelfGroups.forEach(g=>{g.visible=rackMix>.015; g.traverse(o=>{if(o.isMesh && o.material && 'opacity' in o.material){o.material.transparent = o.material.transparent || rackMix < 1;}}); g.position.y=-.18*(1-rackMix);});
      if (ceilingGroupRef) ceilingGroupRef.visible = rackMix > .08;
      if(floorGrid) floorGrid.position.z=-18 + Math.sin(t*.2)*.4;
      if(dust) dust.rotation.y=Math.sin(t*.12)*.025;

      // Camera choreography: begin offset toward the LEFT shelf, then physically
      // truck RIGHT into the clear lane BETWEEN the two symmetrical shelf rows.
      // Do not truck out and return: the move finishes in the aisle centre and
      // HOLDS there so the last 3D composition can match the centred first frame
      // of assets/video/all.mp4. Camera and gaze translate together for parallax.
      const moveStart = 0.85;
      const moveEnd = 7.35;
      const pan = ease((t - moveStart) / (moveEnd - moveStart));
      const cameraX = -2.15 * (1 - pan); // left side -> centre gap, never overshoots
      const lookX = cameraX;             // maintain a straight aisle-facing view
      // Keep the forward dolly alive through the final beat so the real aisle appears to enter the footage.
      const forward = ease((t - 0.85) / 7.7);
      const z = 10.8 - forward * 8.55;
      const y = 3.35 - forward * 1.05;
      const lookZ = -4.2 - forward * 5.5;
      const lookY = 1.2 - forward * 0.18;
      // A very small handheld drift adds life without making the shot shaky.
      const drift = reducedMotion ? 0 : Math.sin(t * .42) * .018;
      camera.position.set(cameraX + drift, y, z);
      camera.lookAt(lookX, lookY, lookZ);
      const brand = root.querySelector('.camex-3d-brand, .loader-brand');
      if (brand) {
        const reveal = ease((t - 4.7) / 1.1);
        brand.style.opacity = t < 3.9 ? '1' : String(Math.max(.12, 1 - reveal * .82));
        // Drive the CSS variables so the choreography wins over legacy !important rules.
        root.style.setProperty('--loader-brand-top', (37 - reveal * 15) + '%');
        root.style.setProperty('--loader-brand-scale', String(1 - reveal * .12));
        root.style.setProperty('--loader-brand-spacing', (0.11 - reveal * .025) + 'em');
      }

      trails.forEach((item,i)=>{
        const cycle=((t*0.78+item.offset)%1.35)/1.35;
        const head=Math.min(1,cycle*1.35);
        const tail=Math.max(0,head-item.length);
        const total=180;
        const start=Math.floor(tail*total);
        const count=Math.max(0,Math.floor((head-tail)*total));
        const indicesPerSegment = item.radialSegments * 6;
        item.line.geometry.setDrawRange(start*indicesPerSegment, count*indicesPerSegment);
        // TubeGeometry uses 6 radial segments for the glow tube.
        item.glow.geometry.setDrawRange(start*6*6, count*6*6);
        const pulse = .92 + .08*Math.sin(t*2.0+i*.7);
        item.line.material.opacity = .94*pulse;
        item.glow.material.opacity = .065*pulse;
        // Do not call CatmullRomCurve3.getPoint() for the moving bead here.
        // In Three.js r128, the centripetal Catmull-Rom endpoint calculation can
        // index beyond the control-point array near the final segment, throwing
        // `Cannot read properties of undefined (reading 'x')` and killing the
        // aisle render loop. Interpolate between validated control points instead;
        // the tube geometry itself remains the original smooth Catmull-Rom curve.
        const beadT = Math.max(0, Math.min(.999, head));
        const curvePoints = item.curve && item.curve.points;
        if (item.bead && Array.isArray(curvePoints) && curvePoints.length >= 2) {
          const scaled = beadT * (curvePoints.length - 1);
          const segment = Math.min(curvePoints.length - 2, Math.floor(scaled));
          const localT = scaled - segment;
          const from = curvePoints[segment];
          const to = curvePoints[segment + 1];
          if (from && to && Number.isFinite(from.x) && Number.isFinite(to.x)) {
            item.bead.position.copy(from).lerp(to, localT);
          }
        }
        item.bead.visible = count > 0;
      });

      if(root.classList.contains('frame-interface')) {
        const notice=root.querySelector('.camex-3d-notice');
        if(notice) notice.style.opacity='1';
      }
      if(renderer) renderer.render(scene,camera);
    }

    function finish() {
      if (finished) return;
      finished = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (fill) fill.style.width = '100%';

      const bridge = document.getElementById('camex-flow-transition');
      const bridgeVideo = document.getElementById('camex-flow-video');
      let handoffComplete = false;
      let bridgeStarted = false;
      let revealTimer = 0;
      let readyTimer = 0;
      let frameCallbackId = null;
      let cutWatchdog = 0;

      const disposeLoader = () => {
        root.classList.add('is-leaving');
        window.setTimeout(() => {
          if (root.isConnected) root.remove();
          if (renderer) renderer.dispose();
          renderer = null;
        }, 650);
      };

      const revealHomepage = () => {
        if (handoffComplete) return;
        handoffComplete = true;
        window.clearTimeout(revealTimer);
        window.clearTimeout(readyTimer);
        window.clearTimeout(cutWatchdog);
        window.clearTimeout(absoluteHandoffTimeout);
        if (bridgeVideo) {
          bridgeVideo.pause();
          if (frameCallbackId !== null && typeof bridgeVideo.cancelVideoFrameCallback === 'function') {
            try { bridgeVideo.cancelVideoFrameCallback(frameCallbackId); } catch (_) {}
          }
        }
        if (bridge) {
          bridge.classList.add('is-cutting');
          window.setTimeout(() => {
            bridge.classList.remove('is-active', 'is-cutting');
            bridge.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('camex-transition-lock');
            window.dispatchEvent(new CustomEvent('camex:experience-ready'));
          }, 920);
        }
        // Ensure the real hero is already moving underneath the bridge.
        const heroVideo = document.getElementById('hero-video');
        if (heroVideo && heroVideo.paused) {
          const heroPlay = heroVideo.play();
          if (heroPlay && typeof heroPlay.catch === 'function') heroPlay.catch(() => {});
        }
        disposeLoader();
      };

      if (!bridge || !bridgeVideo) {
        disposeLoader();
        return;
      }

      // The Google Flow clip has a one-frame ceiling/angle jump at ~7.4s.
      // Cut on the last clean ground-level frame, before that jump.
      const cutAt = Math.max(1, Number(bridge.dataset.cutAt) || 7.25);

      const watchPresentedFrames = (_now, metadata) => {
        if (handoffComplete || !bridgeStarted) return;
        if (metadata && metadata.mediaTime >= cutAt) {
          revealHomepage();
          return;
        }
        if (typeof bridgeVideo.requestVideoFrameCallback === 'function') {
          frameCallbackId = bridgeVideo.requestVideoFrameCallback(watchPresentedFrames);
        }
      };

      const onTimeUpdate = () => {
        // Fallback for browsers without requestVideoFrameCallback.
        if (typeof bridgeVideo.requestVideoFrameCallback !== 'function' &&
            bridgeVideo.currentTime >= cutAt) revealHomepage();
      };
      const onEnded = () => revealHomepage();
      const onError = () => revealHomepage();

      // Hard fail-open: never leave the loader or transition layer covering the site.
      // This is independent of media events and requestVideoFrameCallback.
      const absoluteHandoffTimeout = window.setTimeout(() => {
        if (handoffComplete) return;
        console.error('[Camex loader] Transition failed to reach its cut time; releasing page safely.', { started: bridgeStarted, paused: bridgeVideo.paused, currentTime: bridgeVideo.currentTime, readyState: bridgeVideo.readyState, error: bridgeVideo.error?.message || null });
        revealHomepage();
      }, 17000);

      bridgeVideo.addEventListener('timeupdate', onTimeUpdate);
      bridgeVideo.addEventListener('ended', onEnded, { once: true });
      bridgeVideo.addEventListener('error', onError, { once: true });

      const startBridge = () => {
        if (handoffComplete || bridgeStarted) return;
        bridgeStarted = true;
        console.info('[Camex loader] Starting the single transition controller.', { readyState: bridgeVideo.readyState, source: bridgeVideo.currentSrc || bridgeVideo.querySelector('source')?.src });
        window.clearTimeout(readyTimer);
        bridge.setAttribute('aria-hidden', 'false');
        // Cross-fade the live 3D aisle into the matching real aisle footage.
        // The bridge sits above the loader, so this is an actual visual handoff, not a hidden video.
        bridge.classList.add('is-active');
        root.classList.add('is-transitioning');
        document.body.classList.add('camex-transition-lock');

        // Start muted from time zero. A transient AbortError can occur if load()/play()
        // race during initialization; do not immediately tear down the bridge on the
        // first rejected play promise. Keep the video overlay visible and retry briefly.
        bridgeVideo.muted = true;
        bridgeVideo.defaultMuted = true;
        bridgeVideo.playsInline = true;
        if (bridgeVideo.currentTime > 0.35) {
          try { bridgeVideo.currentTime = 0; } catch (_) {}
        }
        let playAttempts = 0;
        const attemptBridgePlayback = () => {
          if (handoffComplete) return;
          playAttempts += 1;
          let playPromise;
          try { playPromise = bridgeVideo.play(); }
          catch (error) {
            console.warn('[Camex loader] Transition play attempt failed:', error);
            if (playAttempts < 4) window.setTimeout(attemptBridgePlayback, 250);
            else revealHomepage();
            return;
          }
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => {
              console.info('[Camex loader] Transition playback accepted.');
            }).catch(error => {
              console.warn('[Camex loader] Transition play attempt rejected:', error);
              if (handoffComplete) return;
              if (playAttempts < 4) window.setTimeout(attemptBridgePlayback, 250);
              else revealHomepage();
            });
          }
        };
        attemptBridgePlayback();

        if (typeof bridgeVideo.requestVideoFrameCallback === 'function') {
          frameCallbackId = bridgeVideo.requestVideoFrameCallback(watchPresentedFrames);
        }

        // Remove the loader only after the bridge covers it, preventing a black gap.
        window.setTimeout(() => {
          if (!handoffComplete && root.isConnected) {
            root.classList.add('is-leaving');
            window.setTimeout(() => {
              if (root.isConnected) root.remove();
              if (renderer) renderer.dispose();
              renderer = null;
            }, 650);
          }
        }, 550);

        // Safety net: wait for media time to reach the intended cut, rather than
        // cutting at a wall-clock time while the video is still buffering.
        const checkCut = () => {
          if (handoffComplete) return;
          if (bridgeVideo.currentTime >= cutAt) {
            revealHomepage();
          } else {
            cutWatchdog = window.setTimeout(checkCut, 100);
          }
        };
        cutWatchdog = window.setTimeout(checkCut, Math.round(cutAt * 1000) + 1200);
      };

      // If the asset is missing or cannot decode, reveal the page instead of trapping visitors.
      // Allow a little longer for large local video files on slower connections.
      readyTimer = window.setTimeout(revealHomepage, 4800);
      bridgeVideo.addEventListener('canplay', startBridge, { once: true });
      bridgeVideo.addEventListener('loadeddata', startBridge, { once: true });
      try {
        // Do not call load() on an already decoded video: that resets its media pipeline
        // just as the transition begins and can cause a visible freeze on refresh.
        if (bridgeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          startBridge();
        } else {
          bridgeVideo.preload = 'auto';
          bridgeVideo.load();
        }
      } catch (_) {
        revealHomepage();
      }
    }

    function tick(now) {
      if(finished)return;
      const elapsed=now-startTime;
      const t=elapsed/1000;
      if(fill)fill.style.width=Math.min(98,(elapsed/minimumDuration)*98)+'%';
      root.classList.remove('frame-minimal','frame-trails','frame-corridor','frame-amber','frame-shelves','frame-store','frame-interface');
      const stage=t<1.45?'frame-minimal':t<2.55?'frame-trails':t<3.8?'frame-corridor':t<5.0?'frame-amber':t<6.2?'frame-shelves':t<7.35?'frame-store':'frame-interface';
      root.classList.add(stage);
      if (rendererReady) {
        try {
          updateScene(elapsed);
        } catch (error) {
          // A render-time Three.js exception previously killed this RAF loop and left
          // the loader black. Recover to the visible perspective aisle and preserve
          // the video handoff instead of letting one bad frame stop the experience.
          console.error('[Camex loader] 3D aisle animation failed; switching to 2D aisle fallback. Full stack:', error && error.stack ? error.stack : error);
          rendererReady = false;
          try { if (renderer) renderer.dispose(); } catch (_) {}
          renderer = null;
          buildFallback();
        }
      }
      // Keep the small loader percentage visible until COCO-SSD is ready (or times out).
      // The video transition still has a hard fail-open timeout below.
      const modelStatus = root.dataset.camexModelStatus || 'loading';
      if (elapsed >= minimumDuration && modelStatus !== 'loading') { finish(); return; }
      frameId=requestAnimationFrame(tick);
    }

    try { initThree(); }
    catch(error) { root.classList.add('camex-3d-fallback'); console.error('[Camex loader] Three.js/WebGL aisle failed; showing 2D perspective aisle fallback. Check the Three.js CDN and WebGL support.',error); buildFallback(); }

    window.addEventListener('resize',resize,{passive:true});
    window.setTimeout(() => {
      if (!finished) {
        if ((root.dataset.camexModelStatus || 'loading') === 'loading') {
          root.dataset.camexModelStatus = 'timeout';
          const status = document.getElementById('camex-model-load-status');
          const label = document.getElementById('camex-model-load-label');
          const percent = document.getElementById('camex-model-load-percent');
          if (status) status.classList.add('is-offline');
          if (label) label.textContent = 'MODEL TAKING TOO LONG · CONTINUING';
          if (percent) percent.textContent = '—';
        }
        finish();
      }
    }, failSafeDuration);
    // Independent watchdog: even if an animation frame or WebGL context stalls,
    // the loader must never remain over the page indefinitely.
    window.setTimeout(() => {
      const stillThere = document.getElementById('camex-loader');
      if (stillThere && !stillThere.classList.contains('is-leaving')) {
        stillThere.classList.add('is-leaving');
        window.setTimeout(() => { if (stillThere.isConnected) stillThere.remove(); }, 700);
      }
      document.body.classList.remove('camex-transition-lock');
    }, 30000);
    frameId=requestAnimationFrame(tick);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();


/* ===== Existing Camex site JavaScript ===== */

(() => {
  const glow = document.querySelector('.cursor-glow');
  const hero = document.querySelector('.hero');
  const heroVisual = document.querySelector('.hero-visual');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reducedMotion && window.matchMedia('(pointer:fine)').matches && glow && hero && heroVisual) {
    glow.style.opacity = '.9';
    window.addEventListener('pointermove', (event) => {
      glow.style.left = `${event.clientX}px`;
      glow.style.top = `${event.clientY}px`;
      const rect = hero.getBoundingClientRect();
      if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        heroVisual.style.transform = `perspective(1200px) rotateY(${-4 + x * 2.4}deg) rotateX(${-y * 1.8}deg)`;
      }
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { heroVisual.style.transform = ''; });
  }

  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.desktop-nav');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
    nav.classList.toggle('open', !open);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Open navigation');
  }));

  const sceneVideos = {
    retail: 'assets/video/retail-crowd.mp4',
    warehouse: 'assets/video/construction_site_camera_feed.mp4',
    perimeter: 'assets/video/perimeter-driveway.mp4',
    ppe: 'assets/video/construction_site_camera_feed.mp4',
    motion: 'assets/video/garden_camera_feed.mp4',
    headcount: 'assets/video/overhead-crowd.mp4',
    employee: 'assets/video/workspace_camera_feed.mp4',
    restricted: 'assets/video/perimeter-driveway.mp4',
    heatmap: 'assets/video/heat_sensor.mp4',
    theft: 'assets/video/mixkit-two-thieves-recorded-on-a-security-camera-31372-hd-ready.mp4',
    anpr: 'assets/video/number_plate_dectection.mp4',
    traffic: 'assets/video/highway_camera_feed.mp4'
  };

  const scenes = {
    retail: {
      image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.retail, camera: 'RETAIL / AISLE 02', model: 'PEOPLE + QUEUE REVIEW',
      title: 'Understand activity across retail spaces',
      desc: 'Footage preview for footfall, queue and occupancy workflows. Counts and queue events require a configured analytics model.',
      status: 'USE CASE PREVIEW'
    },
    warehouse: {
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.warehouse, camera: 'SITE / OPERATIONS', model: 'SITE SAFETY REVIEW',
      title: 'Review activity in operational spaces',
      desc: 'Construction footage illustrates a safety workflow. PPE compliance is not verified by the general object model in this demo.',
      status: 'USE CASE PREVIEW'
    },
    perimeter: {
      image: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.perimeter, camera: 'PERIMETER / NORTH GATE', model: 'ZONE ACTIVITY REVIEW',
      title: 'Review movement around sensitive areas',
      desc: 'Driveway footage illustrates a perimeter workflow. Restricted-zone alerts depend on configured zones and a supported event model.',
      status: 'USE CASE PREVIEW'
    },
    ppe: {
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.ppe, camera: 'CONSTRUCTION / SITE 01', model: 'PPE & SAFETY WORKFLOW',
      title: 'Make site safety easier to review',
      desc: 'Use construction footage to illustrate where PPE analytics can fit. Helmet, vest and compliance checks need a dedicated compatible model.',
      status: 'MODEL REQUIRED'
    },
    motion: {
      image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.motion, camera: 'FACILITY / MOVEMENT 02', model: 'MOTION REVIEW',
      title: 'Surface movement worth reviewing',
      desc: 'Camera-tracking footage demonstrates the motion-monitoring context. Rules such as after-hours movement need configuration.',
      status: 'USE CASE PREVIEW'
    },
    headcount: {
      image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.headcount, camera: 'ATRIUM / PEOPLE FLOW', model: 'FOOTFALL & OCCUPANCY',
      title: 'Turn crowd movement into planning signals',
      desc: 'Overhead crowd footage is suited to discussing footfall and occupancy. Reliable counting requires a calibrated counting model.',
      status: 'MODEL REQUIRED'
    },
    employee: {
      image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.employee, camera: 'WORKPLACE / FLOOR 02', model: 'WORKSPACE ACTIVITY',
      title: 'Understand how spaces are used',
      desc: 'Workspace footage can support occupancy and workflow analysis. It is not employee identity tracking or a replacement for HR systems.',
      status: 'USE CASE PREVIEW'
    },
    restricted: {
      image: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.restricted, camera: 'GATE / RESTRICTED ZONE', model: 'ZONE ACCESS REVIEW',
      title: 'Keep attention on sensitive zones',
      desc: 'Perimeter footage illustrates zone monitoring. Access events require mapped zones, event rules and deployment validation.',
      status: 'MODEL REQUIRED'
    },
    heatmap: {
      image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.heatmap, camera: 'SPACE / ACTIVITY MAP', model: 'MOVEMENT PATTERN REVIEW',
      title: 'See where activity concentrates',
      desc: 'The supplied heat-sensor clip illustrates the concept. Spatial heat maps require location-aware aggregation or a compatible analytics pipeline.',
      status: 'MODEL REQUIRED'
    },
    theft: {
      image: 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.theft, camera: 'RETAIL / INCIDENT REVIEW', model: 'LOSS PREVENTION REVIEW',
      title: 'Find relevant moments faster',
      desc: 'Incident footage supports a loss-prevention review workflow. Automated theft classification is not performed by this demo model.',
      status: 'USE CASE PREVIEW'
    },
    anpr: {
      image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.anpr, camera: 'VEHICLE / ACCESS LANE', model: 'ANPR WORKFLOW',
      title: 'Streamline vehicle access checks',
      desc: 'Vehicle footage illustrates the use case. Number-plate reading requires a dedicated ANPR model and suitable camera conditions.',
      status: 'MODEL REQUIRED'
    },
    traffic: {
      image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1400&q=85',
      video: sceneVideos.traffic, camera: 'ROAD / TRAFFIC FLOW', model: 'TRAFFIC EVENT REVIEW',
      title: 'Prioritize road events for review',
      desc: 'Highway footage illustrates traffic monitoring. Violation classification requires a validated traffic model and jurisdiction-specific rules.',
      status: 'MODEL REQUIRED'
    }
  };
  const demoImage = document.getElementById('demo-image');
  const tabs = [...document.querySelectorAll('.usecase-card[data-scene]')];
  const demoCameraName = document.getElementById('camera-name');
  const demoModelName = document.getElementById('model-name');
  const modelTitleEl = document.getElementById('model-result-title');
  const modelDescEl = document.getElementById('model-result-desc');
  const modelStatusEl = document.getElementById('model-result-status');
  function setScene(name) {
    const scene = scenes[name];
    if (!scene) return;
    if (demoImage) {
      demoImage.style.opacity = '.25';
      window.setTimeout(() => {
        demoImage.style.backgroundImage = `url("${scene.image}")`;
        demoImage.style.opacity = '1';
      }, 120);
    }
    if (demoCameraName) demoCameraName.textContent = scene.camera;
    if (demoModelName) demoModelName.textContent = scene.model;
    if (modelTitleEl) modelTitleEl.textContent = scene.title;
    if (modelDescEl) modelDescEl.textContent = scene.desc;
    if (modelStatusEl) modelStatusEl.textContent = scene.status;
    tabs.forEach(card => {
      const active = card.dataset.scene === name;
      card.classList.toggle('active', active);
      const action = card.querySelector('.usecase-try');
      if (action) action.setAttribute('aria-pressed', String(active));
    });
    loadDemoVideo(name);
  }
  // Delegated click handling keeps every View footage action responsive.
  document.addEventListener('click', event => {
    const button = event.target.closest('.usecase-try[data-scene]');
    if (!button) return;
    event.preventDefault();
    setScene(button.dataset.scene);
  });

  const revealTargets = document.querySelectorAll('.proof-strip, .section-heading, .step-card, .industry-card, .story-copy, .story-visual, .pricing-card, .faq-list details');
  revealTargets.forEach(el => el.classList.add('reveal'));
  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    revealTargets.forEach(el => observer.observe(el));
  } else revealTargets.forEach(el => el.classList.add('in-view'));


  // Scroll-linked cinematic reveal: supplied CCTV footage -> actual model detections -> interface copy.
  const cinematic = document.querySelector('[data-cinematic]');
  const cinematicMedia = document.getElementById('cinematic-media');
  const cinematicState = document.getElementById('cinematic-state');
  const scrollPercent = document.getElementById('scroll-percent');
  const heroVideo = document.getElementById('hero-video');
  const cameraStory = document.querySelector('[data-camera-story]');
  const storyVideo = document.getElementById('story-video');
  let storyVideoRequest = 0;
  let storyLoadController = null;
  let scrollTicking = false;
  let mobileStoryStep = 0;
  let objectModel = null; // Declared before scroll handlers read it.
  const clamp01 = n => Math.min(1, Math.max(0, n));
  function captureStoryPoster(video) {
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(960, video.videoWidth);
      canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.78);
    } catch (_) { return ''; }
  }
  function updateScrollStories() {
    scrollTicking = false;
    if (cinematic) {
      const rect = cinematic.getBoundingClientRect();
      const span = Math.max(1, cinematic.offsetHeight - window.innerHeight);
      const p = clamp01(-rect.top / span);
      cinematic.style.setProperty('--journey-progress', p.toFixed(4));
      cinematic.style.setProperty('--reveal', p.toFixed(4));
      if (scrollPercent) scrollPercent.textContent = `${String(Math.round(p * 100)).padStart(2, '0')}%`;
      if (cinematicState) cinematicState.textContent = objectModel ? 'MODEL-BASED OBJECT DETECTION' : 'VIDEO FOOTAGE · LOADING MODEL';
    }
    if (!cameraStory) return;
    const rect = cameraStory.getBoundingClientRect();
    // Derive progress from the section's real scrollable height. CSS keeps this
    // section taller than the viewport even when reduced-motion is enabled.
    const span = Math.max(1, cameraStory.offsetHeight - window.innerHeight);
    const p = clamp01(-rect.top / span);
    cameraStory.style.setProperty('--story-progress', p.toFixed(4));
    const fill = document.getElementById('story-scrub-fill');
    const pct = document.getElementById('story-scrub-percent');
    if (fill) fill.style.width = `${Math.round(p * 100)}%`;
    if (pct) pct.textContent = `${String(Math.round(p * 100)).padStart(2, '0')}%`;
    const step = window.matchMedia('(max-width: 760px)').matches
      ? mobileStoryStep
      : Math.min(3, Math.floor(Math.min(0.999999, p) * 4));
    const data = [
      ['01', 'STEP 01 · OBSERVE', 'It starts with<br/><span>what happens.</span>', 'People move through your spaces every day. Camex starts with the camera feeds you already have.', 'RAW FOOTAGE', 'assets/video/overhead-crowd.mp4', 'First, observe the scene. Camex works with the camera feeds already in place.'],
      ['02', 'STEP 02 · DETECT', 'Find the people.<br/><span>Frame the moment.</span>', 'Object detection highlights visible people in the supplied footage. Boxes appear only when the browser model returns a prediction.', 'OBJECT DETECTION', 'assets/video/people_detection_hero.mp4', 'Next, detect visible objects. The boxes show model predictions—not assumptions about what a person intends to do.'],
      ['03', 'STEP 03 · INTERPRET', 'Understand the<br/><span>movement.</span>', 'Entry-and-exit footage helps explain movement through a monitored area. No counts are presented as verified live metrics.', 'MOVEMENT CONTEXT', 'assets/video/mixkit-security-camera-rotates-and-follow-the-object-48922-hd-ready.mp4', 'Then, interpret movement. Entry and exit patterns help teams understand how activity flows through a space.'],
      ['04', 'STEP 04 · REVIEW', 'Turn events into<br/><span>useful insight.</span>', 'Relevant incident footage gives an operator context to review and decide what action is appropriate.', 'INCIDENT REVIEW', 'assets/video/security-incident.mp4', 'Finally, review the relevant moment. Give operators visual context so they can assess an event and decide what to do next.']
    ][step];
    const stepNo = document.getElementById('story-step-number');
    const kicker = document.getElementById('story-kicker');
    const title = document.getElementById('camera-story-title');
    const desc = document.getElementById('camera-story-description');
    const state = document.getElementById('story-scene-state');
    const voiceText = document.getElementById('story-voice-text');
    if (stepNo && stepNo.textContent !== data[0]) {
      // Briefly soften the story copy as the stage changes. The scroll stage is
      // still committed once per boundary; this does not trigger a video reload.
      cameraStory.classList.add('is-stage-changing');
      void cameraStory.offsetWidth;
      stepNo.textContent = data[0];
      kicker.textContent = data[1];
      title.innerHTML = data[2];
      desc.textContent = data[3];
      state.textContent = data[4];
      window.setTimeout(() => cameraStory.classList.remove('is-stage-changing'), 160);
    }
    if (voiceText && voiceText.textContent !== data[6]) {
      voiceText.classList.add('is-changing');
      window.setTimeout(() => { voiceText.textContent = data[6]; voiceText.classList.remove('is-changing'); }, 120);
    }
    document.querySelectorAll('.story-progress-item').forEach((item, i) => item.classList.toggle('active', i === step));
    if (!storyVideo) return;
    // Always keep a local, relevant visual visible on narrow screens while the MP4 loads
    // (or if a source clip is unavailable). The video takes over when decoded.
    const storyPosters = [
      'assets/images/crowd-management.jpg',
      'assets/images/retail-queue.jpg',
      'assets/images/secured-perimeter.jpg',
      'assets/images/hospital-operations.jpg'
    ];
    if (storyVideo.getAttribute('poster') !== storyPosters[step]) {
      storyVideo.setAttribute('poster', storyPosters[step]);
    }
    queueStoryVideo(step, data[5]);
  }
  // Don't start/abort a video decode on every tiny scroll movement near a stage
  // boundary. Let the intended stage settle briefly, then perform one source swap.
  let storyStageSwitchTimer = null;
  let pendingStoryStage = null;
  function queueStoryVideo(step, source) {
    const stageKey = String(step);
    if (storyVideo.dataset.storyStage === stageKey) {
      if (storyStageSwitchTimer) window.clearTimeout(storyStageSwitchTimer);
      storyStageSwitchTimer = null;
      pendingStoryStage = null;
      return;
    }
    pendingStoryStage = { step, source, stageKey };
    if (storyStageSwitchTimer) window.clearTimeout(storyStageSwitchTimer);
    storyStageSwitchTimer = window.setTimeout(() => {
      storyStageSwitchTimer = null;
      const pending = pendingStoryStage;
      if (!pending || pending.stageKey !== String(pending.step)) return;
      // Recheck current scroll stage: never load a clip that is already obsolete.
      let currentStep;
      if (window.matchMedia('(max-width: 760px)').matches) {
        // On mobile, stage changes are explicit taps; scroll position must not
        // override the selected stage or the queued video will never switch.
        currentStep = mobileStoryStep;
      } else {
        const currentRect = cameraStory.getBoundingClientRect();
        const currentSpan = Math.max(1, cameraStory.offsetHeight - window.innerHeight);
        const currentProgress = clamp01(-currentRect.top / currentSpan);
        currentStep = Math.min(3, Math.floor(Math.min(0.999999, currentProgress) * 4));
      }
      if (currentStep !== pending.step) return;
      switchStoryVideo(pending.step, pending.source);
    }, 180);
  }
  function switchStoryVideo(step, source) {
    if (!storyVideo || storyVideo.dataset.storyStage === String(step)) return;
    storyVideo.dataset.storyStage = String(step);
    const currentPath = (() => { try { return new URL(storyVideo.currentSrc || storyVideo.src, location.href).pathname; } catch (_) { return ''; } })();
    const targetPath = new URL(source, location.href).pathname;
    if (currentPath === targetPath && storyVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      storyVideo.play().catch(() => {});
      return;
    }

    // Preserve the last decoded frame while the next clip buffers.
    const retainedFrame = captureStoryPoster(storyVideo);
    if (retainedFrame) storyVideo.poster = retainedFrame;
    if (storyLoadController) storyLoadController.abort();
    storyLoadController = new AbortController();
    const signal = storyLoadController.signal;
    const requestId = ++storyVideoRequest;
    storyVideo.classList.add('is-switching');
    storyVideo.pause();

    const fallbackByStage = {
      0: ['assets/video/overhead-crowd.mp4', 'assets/video/mixkit-security-camera-rotates-and-follow-the-object-48922-hd-ready.mp4', 'assets/video/perimeter-driveway.mp4', 'assets/video/all.mp4'],
      1: ['assets/video/people_detection_hero.mp4', 'assets/video/mixkit-two-thieves-recorded-on-a-security-camera-31372-hd-ready.mp4', 'assets/video/overhead-crowd.mp4', 'assets/video/all.mp4'],
      2: ['assets/video/mixkit-security-camera-rotates-and-follow-the-object-48922-hd-ready.mp4', 'assets/video/overhead-crowd.mp4', 'assets/video/perimeter-driveway.mp4', 'assets/video/all.mp4'],
      3: ['assets/video/security-incident.mp4', 'assets/video/mixkit-two-thieves-recorded-on-a-security-camera-31372-hd-ready.mp4', 'assets/video/perimeter-driveway.mp4', 'assets/video/all.mp4']
    };
    const candidates = [...new Set([source, ...(fallbackByStage[step] || [])])];
    let candidateIndex = 0;
    const isCurrentRequest = () => requestId === storyVideoRequest && storyVideo.dataset.storyStage === String(step);
    const revealClip = () => {
      if (!isCurrentRequest()) return;
      storyVideo.classList.remove('is-switching');
      storyVideo.play().catch(() => {
        // Muted autoplay is normally permitted; keep the decoded frame if playback is blocked.
      });
    };
    const tryNextClip = () => {
      if (!isCurrentRequest()) return;
      candidateIndex += 1;
      if (candidateIndex >= candidates.length) {
        storyVideo.classList.remove('is-switching');
        console.warn('[Camex story] No available clip could be loaded for stage', String(step + 1).padStart(2, '0'));
        return;
      }
      storyVideo.src = candidates[candidateIndex];
      storyVideo.load();
    };
    storyVideo.addEventListener('loadeddata', revealClip, { signal });
    storyVideo.addEventListener('error', tryNextClip, { signal });
    storyVideo.src = candidates[candidateIndex];
    storyVideo.load();
  }
  function requestStoryUpdate() {
    if (!scrollTicking) { scrollTicking = true; window.requestAnimationFrame(updateScrollStories); }
  }
  window.addEventListener('scroll', requestStoryUpdate, { passive: true });
  window.addEventListener('resize', requestStoryUpdate, { passive: true });
  if (storyVideo) {
    storyVideo.pause();
    storyVideo.addEventListener('loadedmetadata', requestStoryUpdate, { once: false });
  }
  if (storyVideo) {
    // The clip is intentionally allowed to play in reduced-motion mode; only camera/UI motion is reduced.
    storyVideo.removeAttribute('autoplay');
    storyVideo.loop = true;
  }
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    const startHeroVideo = () => {
      if (document.getElementById('camex-loader') || document.querySelector('#camex-flow-transition.is-active')) return;
      heroVideo.play().catch(() => {
        if (cinematicState) cinematicState.textContent = 'VIDEO PLAYBACK BLOCKED';
      });
    };
    // Keep video decoding quiet during the 3D loader and transition, then resume the hero.
    window.addEventListener('camex:experience-ready', startHeroVideo, { once: true });
    if (!document.getElementById('camex-loader') && !document.querySelector('#camex-flow-transition.is-active')) {
      if (heroVideo.readyState >= 2) startHeroVideo();
      else heroVideo.addEventListener('canplay', startHeroVideo, { once: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && heroVideo.paused && !document.getElementById('camex-loader')) startHeroVideo();
    });
  }
  // On narrow screens the story is a normal-flow panel, not a pinned scroll trap.
  // Let visitors switch stages directly so the four-step narrative still works.
  if (cameraStory) {
    document.querySelectorAll('.story-progress-item').forEach((item, index) => {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
      const selectStoryStep = () => {
        if (!window.matchMedia('(max-width: 760px)').matches) return;
        mobileStoryStep = index;
        document.querySelectorAll('.story-progress-item').forEach((stage, stageIndex) => {
          stage.setAttribute('aria-pressed', stageIndex === index ? 'true' : 'false');
        });
        updateScrollStories();
      };
      item.addEventListener('click', selectStoryStep);
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectStoryStep();
        }
      });
    });
  }
  updateScrollStories();

  // Scenario videos are loaded only when the visitor chooses a scenario.
  const demoVideo = document.getElementById('demo-video');

  function loadDemoVideo(name) {
    if (!demoVideo) return;
    const src = sceneVideos[name];
    if (!src) return;

    // Set mobile autoplay requirements BEFORE assigning/loading the new source.
    // Chromium can fire media readiness events quickly for cached/local files.
    demoVideo.muted = true;
    demoVideo.defaultMuted = true;
    demoVideo.setAttribute('muted', '');
    demoVideo.setAttribute('playsinline', '');
    demoVideo.playsInline = true;
    demoVideo.autoplay = true;
    demoVideo.loop = true;
    demoVideo.preload = 'auto';

    const currentSrc = (() => { try { return new URL(demoVideo.currentSrc || demoVideo.src, location.href).pathname; } catch (_) { return ''; } })();
    const targetPath = new URL(src, location.href).pathname;
    if (demoVideo.dataset.scene === name && currentSrc === targetPath && demoVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      demoVideo.classList.add('active');
      const resumed = demoVideo.play();
      if (resumed && resumed.catch) resumed.catch(() => {});
      return;
    }

    demoVideo.dataset.scene = name;
    demoVideo.classList.remove('active');
    demoVideo.pause();

    // One shared readiness handler reveals the actual decoded video frame and starts playback.
    // The selected-scene guard prevents late events from an earlier tap taking over.
    const startSelectedVideo = () => {
      if (demoVideo.dataset.scene !== name) return;
      if (demoVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      demoVideo.classList.add('active');
      const playRequest = demoVideo.play();
      if (playRequest && playRequest.catch) {
        playRequest.catch(error => {
          // Keep a decoded frame visible if the browser blocks autoplay; a tap on the video retries.
          console.info('[Camex demo] Playback awaits browser permission:', error?.name || 'play() rejected');
        });
      }
    };
    demoVideo.onloadeddata = startSelectedVideo;
    demoVideo.oncanplay = startSelectedVideo;
    demoVideo.onerror = () => {
      if (demoVideo.dataset.scene !== name) return;
      demoVideo.classList.remove('active');
      console.error(`[Camex demo] Could not load ${src}. Confirm the MP4 exists at this exact path: ${src}`);
    };
    demoVideo.src = src;
    demoVideo.load();
    // Some browsers already have the frame by the time load() returns.
    if (demoVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) startSelectedVideo();
  }
  // Initialize the selected feed on desktop AND mobile. Previously the initial
  // IntersectionObserver was disabled on mobile, leaving the poster visible until a tap.
  if (demoVideo) {
    demoVideo.muted = true;
    demoVideo.playsInline = true;
    setScene(document.querySelector('.usecase-card.active')?.dataset.scene || 'ppe');
  }

  // Public Camex video library: lazy-load each feed when its CARD approaches the viewport.
  const feedGrid = document.getElementById('feed-wall-grid');
  if (feedGrid) {
    const feedItems = [
      // Lead with distinct feeds not reused in the main use-case demo.
      ['Subway camera', 'subway_cam_feed.mp4'],
      ['Train camera', 'train_cam_feed.mp4'],
      ['Factory camera', 'factory_camera_feed.mp4'],
      ['Overhead crowd', 'overhead-crowd.mp4'],
      ['Perimeter driveway', 'perimeter-driveway.mp4'],
      ['Retail crowd', 'retail-crowd.mp4'],
      ['Kitchen camera', 'kitchen_camera_feed.mp4'],
      ['Workspace camera', 'workspace_camera_feed.mp4'],
      ['Highway camera', 'highway_camera_feed.mp4'],
      ['Heat sensor', 'heat_sensor.mp4'],
      ['Construction site', 'construction_site_camera_feed.mp4'],
      ['Drone camera', 'drone_camera_feed.mp4'],
      ['Shopping center camera', 'shopping_center_camera_feed.mp4'],
      ['Garden camera', 'garden_camera_feed.mp4'],
      ['Canva aisle aside', 'canva-aisle-aside.mp4'],
      ['Camex aisle to perimeter', 'camex-aisle-to-perimeter.mp4'],
      ['Google Flow transition', 'google-flow-transition.mp4'],
      ['Black background wall camera', 'black_background_wall_fitted_camera.mp4'],
      ['Green background wall camera', 'green_background_wall_fitted_camera.mp4'],
      ['People walking through streets', 'people_waking_through_streets.mp4'],
      ['Car pouch camera', 'car_pouch_camera_feed.mp4'],
      ['Mavic 4 Pro drone', 'mavic_4_pro_drone_camera.mp4'],
      ['Person monitoring camera', 'person_monitoring_camera.mp4'],
      ['All-in-one clip', 'all.mp4'],
      ['People detection', 'people_detection_hero.mp4'],
      ['Entry and exit count', 'entry_exit_count.mp4'],
      ['Security incident', 'security-incident.mp4'],
      ['Number plate detection', 'number_plate_dectection.mp4']
    ].map(([name, filename]) => ({ name, file: `assets/video/${filename}` }));

    const INITIAL_FEED_COUNT = 3;
    const feedToggle = document.getElementById('feed-wall-toggle');
    const feedToggleLabel = feedToggle?.querySelector('span');
    const feedCards = [];

    const feedObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const card = entry.target;
        const video = card.querySelector('video');
        const loading = card.querySelector('.feed-card-loading');
        if (!video || !loading) return;
        if (entry.isIntersecting) {
          if (!video.dataset.loaded) {
            loading.textContent = 'Loading feed…';
            loading.classList.remove('is-hidden');
            video.dataset.loaded = 'true';
            video.src = video.dataset.src;
            video.load();
            // Don't leave a misleading loading message indefinitely if the remote host stalls.
            video.dataset.loadTimer = String(window.setTimeout(() => {
              if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA && !video.error) {
                loading.textContent = 'Feed is taking longer than expected';
              }
            }, 10000));
          }
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {
            // Autoplay may be blocked by browser policy; keep controls available to the user.
            video.controls = true;
            loading.textContent = 'Tap to play feed';
            loading.classList.remove('is-hidden');
          });
        } else {
          video.pause();
        }
      });
    }, { rootMargin: '500px 0px', threshold: 0.01 });

    const feedCount = document.querySelector('.feed-wall-toolbar > span:first-child');
    if (feedCount) feedCount.innerHTML = `<i class="feed-wall-dot"></i> ${String(feedItems.length).padStart(2, '0')} SOURCE CLIPS`;
    if (feedToggleLabel) feedToggleLabel.textContent = `SHOW ALL ${feedItems.length} FEEDS`;
    feedItems.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'feed-card';
      if (index >= INITIAL_FEED_COUNT) card.hidden = true;
      const frame = document.createElement('div');
      frame.className = 'feed-card-frame';
      const video = document.createElement('video');
      video.className = 'feed-card-video';
      video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('aria-label', `${item.name} video`);
      video.dataset.src = item.file;
      const badge = document.createElement('span'); badge.className = 'feed-card-badge'; badge.textContent = 'SOURCE FEED';
      const number = document.createElement('span'); number.className = 'feed-card-number'; number.textContent = `CAM ${String(index + 1).padStart(2, '0')}`;
      const loading = document.createElement('span'); loading.className = 'feed-card-loading'; loading.textContent = 'Scroll near to load';
      video.addEventListener('loadeddata', () => {
        if (video.dataset.loadTimer) window.clearTimeout(Number(video.dataset.loadTimer));
        loading.classList.add('is-hidden');
        card.classList.remove('feed-card-error');
      });
      video.addEventListener('error', () => {
        if (video.dataset.loadTimer) window.clearTimeout(Number(video.dataset.loadTimer));
        loading.textContent = 'Source unavailable';
        loading.classList.remove('is-hidden');
        card.classList.add('feed-card-error');
      });
      video.addEventListener('stalled', () => {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          loading.textContent = 'Waiting for source…';
          loading.classList.remove('is-hidden');
        }
      });
      frame.append(video, badge, number, loading);
      const meta = document.createElement('div'); meta.className = 'feed-card-meta';
      const title = document.createElement('strong'); title.textContent = item.name;
      const source = document.createElement('span'); source.textContent = item.file;
      meta.append(title, source); card.append(frame, meta); feedGrid.append(card);
      feedCards.push(card);
      // Keep hidden cards completely dormant; only visible cards enter the lazy-load observer.
      if (!card.hidden) feedObserver.observe(card);
    });

    if (feedToggle) {
      feedToggle.addEventListener('click', () => {
        const expanded = feedToggle.getAttribute('aria-expanded') === 'true';
        const nextExpanded = !expanded;
        feedToggle.setAttribute('aria-expanded', String(nextExpanded));
        feedGrid.classList.toggle('is-expanded', nextExpanded);
        feedCards.forEach((card, index) => {
          if (index < INITIAL_FEED_COUNT) return;
          if (nextExpanded) {
            card.hidden = false;
            feedObserver.observe(card);
          } else {
            feedObserver.unobserve(card);
            const video = card.querySelector('video');
            if (video) video.pause();
            card.hidden = true;
          }
        });
        if (feedToggleLabel) feedToggleLabel.textContent = nextExpanded ? 'SHOW FEWER FEEDS' : `SHOW ALL ${feedItems.length} FEEDS`;
        const icon = feedToggle.querySelector('b');
        if (icon) icon.textContent = nextExpanded ? '−' : '＋';
      });
    }
  }

  // Actual object detection: draw only boxes returned by COCO-SSD. No hard-coded boxes, skeletons, or fabricated events.
  const detectionVideos = [
    { video: heroVideo, canvas: document.getElementById('hero-detections') },
    { video: storyVideo, canvas: document.getElementById('story-detections') },
    { video: demoVideo, canvas: document.getElementById('demo-detections') }
  ].filter(x => x.video && x.canvas);
  const modelTitle = document.getElementById('model-result-title');
  const modelDesc = document.getElementById('model-result-desc');
  const modelStatus = document.getElementById('model-result-status');
  const modelNote = document.getElementById('model-status-note');
  let inferenceBusy = false;
  let latestPredictions = [];
  const loaderRoot = document.getElementById('camex-loader');
  let experienceReady = !loaderRoot;
  let detectionLoopStarted = false;
  const loadStatusEl = document.getElementById('camex-model-load-status');
  const loadLabelEl = document.getElementById('camex-model-load-label');
  const loadPercentEl = document.getElementById('camex-model-load-percent');
  let modelLoadProgress = 3;
  let modelLoadResolved = false;
  let modelProgressTimer = null;
  if (loaderRoot) loaderRoot.dataset.camexModelStatus = 'loading';
  const paintModelProgress = (value, label, state = 'loading') => {
    modelLoadProgress = value;
    if (loadPercentEl) loadPercentEl.textContent = state === 'offline' ? '—' : `${Math.round(value).toString().padStart(2, '0')}%`;
    if (loadLabelEl) loadLabelEl.textContent = label;
    if (loadStatusEl) {
      loadStatusEl.classList.toggle('is-ready', state === 'ready');
      loadStatusEl.classList.toggle('is-offline', state === 'offline');
    }
  };
  // coco-ssd.load() doesn't expose byte-level progress. Show a restrained readiness estimate,
  // cap it at 92%, and only display 100% once the actual model promise resolves.
  paintModelProgress(3, 'INITIALIZING AI MODEL');
  if (loaderRoot) {
    modelProgressTimer = window.setInterval(() => {
      if (modelLoadResolved) return;
      const next = modelLoadProgress < 58 ? modelLoadProgress + 1.25 : modelLoadProgress + 0.32;
      paintModelProgress(Math.min(92, next), modelLoadProgress < 58 ? 'LOADING AI MODEL' : 'PREPARING DETECTION ENGINE');
    }, 180);
    window.setTimeout(() => {
      if (!modelLoadResolved && loaderRoot.dataset.camexModelStatus === 'loading') {
        loaderRoot.dataset.camexModelStatus = 'timeout';
        paintModelProgress(92, 'MODEL SLOW · CONTINUING', 'offline');
        if (modelProgressTimer) window.clearInterval(modelProgressTimer);
      }
    }, 17000);
  }
  const startDetectionLoop = () => {
    if (!experienceReady || !objectModel || detectionLoopStarted) return;
    detectionLoopStarted = true;
    runDetections();
  };
  function fitCanvas(video, canvas) {
    const rect = video.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    if (!video.videoWidth || !video.videoHeight) return null;
    // Match object-fit: cover cropping so boxes align with the visible video.
    const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
    return { ctx, rect, scale, ox: (rect.width - video.videoWidth * scale) / 2, oy: (rect.height - video.videoHeight * scale) / 2 };
  }
  function drawPredictions(video, canvas, predictions) {
    const fit = fitCanvas(video, canvas); if (!fit) return;
    const { ctx, rect, scale, ox, oy } = fit;
    predictions.filter(p => p.score >= 0.45).forEach(p => {
      const [x, y, w, h] = p.bbox; const bx = x * scale + ox, by = y * scale + oy, bw = w * scale, bh = h * scale;
      if (bx + bw < 0 || by + bh < 0 || bx > rect.width || by > rect.height) return;
      ctx.strokeStyle = '#53f5b7'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
      const label = `${p.class} ${(p.score * 100).toFixed(0)}%`; ctx.font = '600 11px ui-monospace, monospace';
      const tw = ctx.measureText(label).width + 12, th = 21, ly = Math.max(0, by - th);
      ctx.fillStyle = '#53f5b7'; ctx.fillRect(bx, ly, tw, th); ctx.fillStyle = '#07120f'; ctx.fillText(label, bx + 6, ly + 14);
    });
  }
  const DETECTION_INTERVAL_MS = 260; // ~3.8 inference passes/sec; keeps scroll/video decoding responsive.
  let detectionTimer = null;
  function scheduleDetectionPass(delay = DETECTION_INTERVAL_MS) {
    if (detectionTimer) window.clearTimeout(detectionTimer);
    if (experienceReady && objectModel && !document.hidden) {
      detectionTimer = window.setTimeout(runDetections, delay);
    }
  }
  async function runDetections() {
    detectionTimer = null;
    if (!experienceReady || !objectModel || document.hidden) return;
    if (inferenceBusy) { scheduleDetectionPass(); return; }
    const active = detectionVideos.find(({ video }) => {
      if (video.paused || video.ended || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
      const rect = video.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    });
    if (!active) { scheduleDetectionPass(420); return; }
    inferenceBusy = true;
    try {
      const predictions = await objectModel.detect(active.video);
      // A video can be replaced while inference is in flight. Draw only if it is still current and visible.
      const rect = active.video.getBoundingClientRect();
      if (!active.video.paused && rect.bottom > 0 && rect.top < window.innerHeight) {
        latestPredictions = predictions;
        drawPredictions(active.video, active.canvas, predictions);
      }
      if (active.video === demoVideo && modelTitle) {
        const shown = predictions.filter(p => p.score >= .45);
        modelTitle.textContent = shown.length ? `${shown.length} objects detected in current frame` : 'No objects above confidence threshold';
        modelDesc.textContent = shown.length ? shown.slice(0, 5).map(p => `${p.class} ${(p.score * 100).toFixed(0)}%`).join(' · ') : 'The model returned no qualifying detections for this frame.';
        modelStatus.textContent = 'MODEL OUTPUT';
      }
    } catch (e) {
      if (modelNote) modelNote.textContent = 'Detection failed for this frame. No synthetic results are shown.';
    } finally {
      inferenceBusy = false;
      scheduleDetectionPass();
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (detectionTimer) window.clearTimeout(detectionTimer);
      detectionTimer = null;
    } else {
      scheduleDetectionPass(80);
    }
  });
  const bootObjectDetection = () => {
    if (window.__camexObjectDetectionBooted) return;
    window.__camexObjectDetectionBooted = true;
    if (window.cocoSsd && window.tf) {
      if (modelTitle) modelTitle.textContent = 'Loading object detection model…';
      cocoSsd.load({ base: 'lite_mobilenet_v2' }).then(model => {
        objectModel = model;
        modelLoadResolved = true;
        if (modelProgressTimer) window.clearInterval(modelProgressTimer);
        if (loaderRoot) loaderRoot.dataset.camexModelStatus = 'ready';
        paintModelProgress(100, 'AI MODEL READY · DETECTION ARMED', 'ready');
        if (modelTitle) modelTitle.textContent = 'Object detection ready';
        if (modelDesc) modelDesc.textContent = 'Boxes and labels appear only when returned by the model.';
        if (modelStatus) modelStatus.textContent = 'READY';
        if (modelNote) modelNote.textContent = 'COCO-SSD detects common object classes; it does not infer queue events, intent, identity, or pose.';
        startDetectionLoop();
      }).catch(() => {
        modelLoadResolved = true;
        if (modelProgressTimer) window.clearInterval(modelProgressTimer);
        if (loaderRoot && loaderRoot.dataset.camexModelStatus === 'loading') loaderRoot.dataset.camexModelStatus = 'offline';
        paintModelProgress(92, 'MODEL UNAVAILABLE · CONTINUING', 'offline');
        if (modelTitle) modelTitle.textContent = 'Model unavailable';
        if (modelDesc) modelDesc.textContent = 'Check internet access to load the detection model. No detections are simulated.';
        if (modelStatus) modelStatus.textContent = 'OFFLINE';
      });
    } else {
      modelLoadResolved = true;
      if (loaderRoot && loaderRoot.dataset.camexModelStatus === 'loading') loaderRoot.dataset.camexModelStatus = 'offline';
      paintModelProgress(92, 'MODEL UNAVAILABLE · CONTINUING', 'offline');
      if (modelTitle) modelTitle.textContent = 'Detection model unavailable';
      if (modelDesc) modelDesc.textContent = 'TensorFlow.js / COCO-SSD could not load. No detections are simulated.';
      if (modelStatus) modelStatus.textContent = 'OFFLINE';
    }
  };
  // Load weights while the cinematic loader is visible; begin inference only after the hero is revealed.
  bootObjectDetection();
  window.addEventListener('camex:experience-ready', () => {
    experienceReady = true;
    startDetectionLoop();
  }, { once: true });
  window.addEventListener('resize', () => detectionVideos.forEach(x => { if (objectModel && x.video.readyState >= 2) drawPredictions(x.video, x.canvas, []) }));

})();

/* V43: subtle cursor spotlight on interactive cards; disabled for touch and reduced motion. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduceMotion || !finePointer) return;
  document.querySelectorAll('.live-section .usecase-card, .industries-section .industry-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    }, { passive: true });
  });
})();





/* V45: make the marquee motion state explicit and restart animations after stylesheet hot reloads. */
(() => {
  document.querySelectorAll('.trust-marquee-track').forEach((track, index) => {
    track.style.animationPlayState = 'running';
    track.style.animationDelay = `${index * -2.5}s`;
    // Force a style refresh so the animation starts reliably after local CSS hot reloads.
    void track.offsetWidth;
    track.classList.add('camex-marquee-running');
  });
})();




/* V48: fill the marquee with evenly spaced logos, then create an identical twin.
   Each half is wider than the viewport, so -50% always lands on the matching twin. */
(() => {
  const marquees = [...document.querySelectorAll('.trust-marquee')];
  if (!marquees.length) return;
  const rebuild = (marquee) => {
    const track = marquee.querySelector('.trust-marquee-track');
    const sets = track ? [...track.querySelectorAll('.trust-logo-set')] : [];
    if (!track || !sets.length) return;
    const first = sets[0];
    const second = sets[1] || first.cloneNode(false);
    if (!second.parentElement) track.appendChild(second);

    if (!first.dataset.baseHtml) {
      first.dataset.baseHtml = first.innerHTML;
    }
    const baseHtml = first.dataset.baseHtml;
    first.innerHTML = baseHtml;
    const viewportWidth = marquee.getBoundingClientRect().width || 600;
    const targetWidth = viewportWidth + 80;

    // Repeat the original logo sequence only as many times as needed to cover the viewport.
    let guard = 0;
    while (first.scrollWidth < targetWidth && guard < 20) {
      const originalItems = [...first.children].filter((el) => !el.hasAttribute('data-marquee-copy'));
      originalItems.forEach((item) => {
        const copy = item.cloneNode(true);
        copy.setAttribute('data-marquee-copy', 'true');
        copy.setAttribute('aria-hidden', 'true');
        first.appendChild(copy);
      });
      guard++;
    }

    second.innerHTML = first.innerHTML;
    second.setAttribute('aria-hidden', 'true');
    track.style.width = 'max-content';
    track.style.animationName = 'none';
    void track.offsetWidth;
    track.style.animationName = '';
    track.style.animationPlayState = 'running';
  };
  let resizeTimer;
  const rebuildAll = () => marquees.forEach(rebuild);
  rebuildAll();
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuildAll, 120);
  }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuildAll);
})();


/* V59 — real overlay element; follows the cursor and cannot be stuck at the center. */
(() => {
  function installCursorGlow(cta) {
    if (!cta || cta.dataset.cursorGlowInstalled === 'true') return;
    cta.dataset.cursorGlowInstalled = 'true';

    const style = window.getComputedStyle(cta);
    if (style.position === 'static') cta.style.position = 'relative';
    cta.style.setProperty('isolation', 'isolate');
    cta.style.setProperty('overflow', 'hidden');

    const glow = document.createElement('span');
    glow.className = 'cta-cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    Object.assign(glow.style, {
      position: 'absolute',
      width: '170px',
      height: '170px',
      left: '0px',
      top: '0px',
      borderRadius: '50%',
      pointerEvents: 'none',
      zIndex: '0',
      opacity: '0',
      transform: 'translate(-50%, -50%)',
      background: 'radial-gradient(circle, rgba(190,255,221,.62) 0%, rgba(125,218,169,.28) 30%, rgba(125,218,169,.10) 53%, rgba(125,218,169,0) 72%)',
      filter: 'blur(2px)',
      transition: 'opacity 120ms ease',
      willChange: 'left, top, opacity'
    });
    cta.insertBefore(glow, cta.firstChild);

    // Keep text, icon and other content above the glow layer.
    Array.from(cta.children).forEach(child => {
      if (child !== glow) {
        if (window.getComputedStyle(child).position === 'static') {
          child.style.position = 'relative';
        }
        child.style.zIndex = '1';
      }
    });

    const move = event => {
      if (event.pointerType === 'touch') return;
      const rect = cta.getBoundingClientRect();
      glow.style.left = `${event.clientX - rect.left}px`;
      glow.style.top = `${event.clientY - rect.top}px`;
      glow.style.opacity = '1';
    };
    const leave = () => { glow.style.opacity = '0'; };

    cta.addEventListener('pointerenter', move, { passive: true });
    cta.addEventListener('pointermove', move, { passive: true });
    cta.addEventListener('pointerleave', leave, { passive: true });
    cta.addEventListener('mouseenter', move, { passive: true });
    cta.addEventListener('mousemove', move, { passive: true });
    cta.addEventListener('mouseleave', leave, { passive: true });
  }

  const installAll = () => document.querySelectorAll('.glow-cta').forEach(installCursorGlow);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAll, { once: true });
  } else {
    installAll();
  }
  // Accommodate CTA markup that is injected after the main page initializes.
  const observer = new MutationObserver(installAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
// Pointer-following edge glow: use pointer coordinates relative to each card.
(function installPointerEdgeGlow(){
  const selectors='.case-card,.plan-card,.onepager-grid article,.process-step,.usecase-card,.feed-card,.feed-wall-card,.compare-table-wrap,.faq-item,.industry-card,.step-list li,.code-panel,.notice-card,.process-flow,.tag-cloud';
  const install=()=>document.querySelectorAll(selectors).forEach(card=>{
    if(card.dataset.edgeGlowReady==='1') return; card.dataset.edgeGlowReady='1';
    const move=e=>{const r=card.getBoundingClientRect();if(!r.width||!r.height)return;const x=Math.max(0,Math.min(r.width,e.clientX-r.left));const y=Math.max(0,Math.min(r.height,e.clientY-r.top));const px=x/r.width*100,py=y/r.height*100;const dx=x-r.width/2,dy=y-r.height/2;const edge=Math.min(1,Math.max(Math.abs(dx)/(r.width/2),Math.abs(dy)/(r.height/2)));const deg=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360;card.style.setProperty('--pointer-x',px.toFixed(2)+'%');card.style.setProperty('--pointer-y',py.toFixed(2)+'%');card.style.setProperty('--pointer-deg',deg.toFixed(1)+'deg');card.style.setProperty('--edge-alpha',String(.72+edge*.28));card.style.setProperty('--glow-alpha',String(.25+edge*.45));};
    const leave=()=>{card.style.setProperty('--edge-alpha','0');card.style.setProperty('--glow-alpha','0');};
    card.addEventListener('pointerenter',move,{passive:true});card.addEventListener('pointermove',move,{passive:true});card.addEventListener('pointerleave',leave,{passive:true});card.addEventListener('focusin',()=>{card.style.setProperty('--edge-alpha','.85');card.style.setProperty('--glow-alpha','.4');});card.addEventListener('focusout',leave);
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
})();
