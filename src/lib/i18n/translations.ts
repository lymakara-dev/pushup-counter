export type Language = "en" | "km";

export interface TranslationDictionary {
  appName: string;
  appDescription: string;
  privacyMessage: string;
  loadingModel: string;
  failedToLoadModel: string;
  startCamera: string;
  stopCamera: string;
  reset: string;
  pushUps: string;
  status: string;
  voiceOn: string;
  voiceOff: string;
  disableVoice: string;
  enableVoice: string;
  sideView: string;
  frontView: string;
  language: string;

  // Position Issues
  NO_PERSON: string;
  BODY_NOT_VISIBLE: string;
  TOO_CLOSE: string;
  TOO_FAR: string;
  MOVE_LEFT: string;
  MOVE_RIGHT: string;
  MOVE_UP: string;
  MOVE_DOWN: string;
  TURN_SIDEWAYS: string;
  FACE_CAMERA: string;
  GET_IN_PUSHUP_POSITION: string;
  LOW_CONFIDENCE: string;

  // States & Feedback
  PERFECT_POSITION: string;
  READY: string;
  GO: string;
  DOWN: string;
  UP: string;
  POSE_LOST: string;
  RESET: string;
  
  POSITIONING: string;
  WORKOUT: string;
  PAUSED: string;
  BODY_AREA: string;
  
  // Dynamic
  pausedText: (msg: string) => string;
}

export const en: TranslationDictionary = {
  appName: "Push-Up Counter",
  appDescription: "Count your push-ups using real-time body tracking.",
  privacyMessage: "Your camera video stays on your device. Video is processed locally and never uploaded.",
  loadingModel: "Loading pose detection...",
  failedToLoadModel: "Failed to load pose model",
  startCamera: "Start Camera",
  stopCamera: "Stop Camera",
  reset: "Reset",
  pushUps: "Push-ups",
  status: "Status",
  voiceOn: "🔊 Voice On",
  voiceOff: "🔇 Voice Off",
  disableVoice: "Disable Voice",
  enableVoice: "Enable Voice",
  sideView: "Side View",
  frontView: "Front View",
  language: "Language",

  NO_PERSON: "Looking for your body.",
  BODY_NOT_VISIBLE: "Show your whole body.",
  TOO_CLOSE: "Move farther away.",
  TOO_FAR: "Move closer.",
  MOVE_LEFT: "Move left.",
  MOVE_RIGHT: "Move right.",
  MOVE_UP: "Move up.",
  MOVE_DOWN: "Move down.",
  TURN_SIDEWAYS: "Turn sideways.",
  FACE_CAMERA: "Face the camera directly.",
  GET_IN_PUSHUP_POSITION: "Get into push-up position.",
  LOW_CONFIDENCE: "Show your whole body.",

  PERFECT_POSITION: "Perfect position.",
  READY: "Ready.",
  GO: "Go.",
  DOWN: "Down.",
  UP: "Up.",
  POSE_LOST: "Pose lost. Make sure your whole body is visible.",
  RESET: "Reset.",
  
  POSITIONING: "Positioning",
  WORKOUT: "Workout",
  PAUSED: "Paused",
  BODY_AREA: "Body Area",
  
  pausedText: (msg: string) => `PAUSED: ${msg}`
};

export const km: TranslationDictionary = {
  appName: "កម្មវិធីរាប់ Push-Up",
  appDescription: "រាប់ការធ្វើ Push-Up របស់អ្នកដោយប្រើប្រព័ន្ធតាមដានរាងកាយពិតៗ។",
  privacyMessage: "វីដេអូពីកាមេរ៉ារបស់អ្នកត្រូវបានដំណើរការនៅលើឧបករណ៍របស់អ្នក ហើយមិនត្រូវបានបញ្ជូនទៅណាទេ។",
  loadingModel: "កំពុងផ្ទុកប្រព័ន្ធស្គាល់ចលនា...",
  failedToLoadModel: "បរាជ័យក្នុងការផ្ទុកប្រព័ន្ធស្គាល់ចលនា",
  startCamera: "បើកកាមេរ៉ា",
  stopCamera: "បិទកាមេរ៉ា",
  reset: "កំណត់ឡើងវិញ",
  pushUps: "ចំនួន Push-Up",
  status: "ស្ថានភាព",
  voiceOn: "🔊 បើកសំឡេង",
  voiceOff: "🔇 បិទសំឡេង",
  disableVoice: "បិទសំឡេង",
  enableVoice: "បើកសំឡេង",
  sideView: "មើលពីចំហៀង",
  frontView: "មើលពីខាងមុខ",
  language: "ភាសា",

  NO_PERSON: "កំពុងស្វែងរករាងកាយរបស់អ្នក",
  BODY_NOT_VISIBLE: "សូមប្រាកដថារាងកាយរបស់អ្នកមើលឃើញពេញលេញ",
  TOO_CLOSE: "សូមថយចេញពីកាមេរ៉ាបន្តិច",
  TOO_FAR: "សូមចូលមកជិតកាមេរ៉ាបន្តិច",
  MOVE_LEFT: "រំកិលទៅឆ្វេង",
  MOVE_RIGHT: "រំកិលទៅស្តាំ",
  MOVE_UP: "រំកិលឡើងលើ",
  MOVE_DOWN: "រំកិលចុះក្រោម",
  TURN_SIDEWAYS: "សូមងាកចំហៀង",
  FACE_CAMERA: "សូមបែរមុខចំកាមេរ៉ា",
  GET_IN_PUSHUP_POSITION: "សូមចូលទៅកាន់ទីតាំងធ្វើ Push-Up",
  LOW_CONFIDENCE: "សូមប្រាកដថារាងកាយរបស់អ្នកមើលឃើញពេញលេញ",

  PERFECT_POSITION: "ទីតាំងល្អឥតខ្ចោះ",
  READY: "រួចរាល់",
  GO: "ចាប់ផ្តើម",
  DOWN: "ចុះក្រោម",
  UP: "ឡើងលើ",
  POSE_LOST: "បាត់ទីតាំងរាងកាយ។ សូមបង្ហាញរាងកាយទាំងមូល។",
  RESET: "កំណត់ឡើងវិញ",
  
  POSITIONING: "កំពុងរៀបចំទីតាំង",
  WORKOUT: "កំពុងហាត់ប្រាណ",
  PAUSED: "បានផ្អាក",
  BODY_AREA: "ទីតាំងរាងកាយ",
  
  pausedText: (msg: string) => `ផ្អាក៖ ${msg}`
};

export const dicts: Record<Language, TranslationDictionary> = { en, km };

export function getTranslation(lang: Language): TranslationDictionary {
  return dicts[lang] || dicts.en;
}
