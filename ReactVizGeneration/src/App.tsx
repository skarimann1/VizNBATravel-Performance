import NBATravelMap from "./components/NbaTravelMap";
import NBATravelMap_v2 from "./components/NbaTravelMap_v2";
import NBATravelMap_v3 from "./components/NbaTravelMap_v3";
import FatigueIndexChart from "./components/FatigueIndexChart";

import FatigueScatterPlot from "./components/FatigueScatterPlot";

function App() {
  return (
    <div>
      <NBATravelMap_v3 />
      <FatigueIndexChart />
      <FatigueScatterPlot />
    </div>
  );
}

export default App;