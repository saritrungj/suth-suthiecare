import { useParams } from "react-router-dom";
import TeenClinicForm from "./teen/TeenClinicForm";
import STDClinicForm from "./std/STDClinicForm";
import LSMClinicForm from "./lsm/LSMClinicForm";

function Assessment() {
  const { type } = useParams();

  if (type === "teen-clinic") {
    return <TeenClinicForm />;
  }

  if (type === "std-clinic") {
    return <STDClinicForm />;
  }

  if (type === "lsm-clinic") {
    return <LSMClinicForm />;
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>ไม่พบแบบประเมิน</h1>
    </div>
  );
}

export default Assessment;
