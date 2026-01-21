// 재고 데이터 - 이 파일을 수정하면 Git에 커밋하세요
export const inventoryData = {
  "categories": {
    "해양": {
      "다이아몬드": {
        "quantity": 35,
        "required": 100
      },
      "산호": {
        "quantity": 20,
        "required": 50
      }
    },
    "채광": {
      "철괴": {
        "quantity": 45,
        "required": 128
      },
      "레드스톤": {
        "quantity": 15,
        "required": 128
      }
    },
    "요리": {
      "음식": {
        "quantity": 80,
        "required": 256
      },
      "나무": {
        "quantity": 200,
        "required": 320
      }
    }
  },
  "collecting": {},
  "crafting": {
    "categories": {
      "해양": {
        "ㅇㄴ": {
          "quantity": 0,
          "required": 128
        }
      }
    },
    "crafting": {},
    "recipes": {
      "해양": {
        "ㅇㄴ": [
          {
            "name": "다이아몬드",
            "quantity": 1,
            "category": "해양"
          }
        ]
      }
    }
  },
  "settings": {
    "uiMode": "normal",
    "barLength": 15
  },
  "history": [
    {
      "timestamp": "2026-01-21T05:20:48.825Z",
      "type": "crafting",
      "category": "해양",
      "itemName": "ㅇㄴ",
      "action": "add",
      "details": "초기: 0개, 목표: 128개",
      "userName": "레브"
    }
  ]
};
