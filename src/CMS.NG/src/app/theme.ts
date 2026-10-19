import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { Translation } from 'primeng/api';

/** Aura with an emerald primary palette. */
export const CmsPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '{emerald.500}',
      600: '{emerald.600}',
      700: '{emerald.700}',
      800: '{emerald.800}',
      900: '{emerald.900}',
      950: '{emerald.950}',
    },
  },
});

export const zhTW: Translation = {
  accept: '確定',
  reject: '取消',
  emptyMessage: '無資料',
  emptyFilterMessage: '查無符合項目',
  emptySelectionMessage: '未選取',
  selectionMessage: '已選取 {0} 項',
  searchMessage: '共 {0} 筆結果',
};
