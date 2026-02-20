import {
  Animation,
  BodyParts,
  BodyPart,
  Model,
  Motion,
  Playback
} from "../../../robot/runtime/compiler/index";
import {createBlinkAnimation, createBreathingAnimation} from "./customAnimations";

export const ConversationModels = () => {
  return (
    <>
      <Model id="primary"
        scale={.1}
        position={[10, 10, 0]}
        metalness={0.95}
        roughness={0.08}
        rotation={[0, -0.2, 0]}
      >
        <BodyParts>
          <BodyPart id="HEAD" color="#dddddd" metalness={0.6} roughness={0.3} opacity={1}/>
          <BodyPart id="EYES" color="#999" metalness={0} roughness={0.9} opacity={1}/>
          <BodyPart id="CHEST" opacity={0.6}/>
        </BodyParts>
        <Playback>
          <Motion customAnimations={[createBreathingAnimation(), createBlinkAnimation()]}/>
          <Animation enabled={false}/>
        </Playback>
      </Model>
    </>
  )
}
